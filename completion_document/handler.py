import json
import litellm
import logging
import os
import pickle
import re
import requests
from panel.models import File, Message, Panel, Thread
from django.http import JsonResponse, StreamingHttpResponse
from jinja2 import Template
from openai import OpenAI
from sentence_transformers import SentenceTransformer
from scipy.spatial.distance import cosine
from unstructured.partition.auto import partition
from unstructured.chunking.title import chunk_by_title

logger = logging.getLogger("app")


# File Entrypoint
def file_handler(file, thread, panel):
    try:
        return StreamingHttpResponse(
            file_stream(file, thread, panel), content_type="text/plain"
        )
    except Exception as e:
        logger.error(e, exc_info=True)
        return JsonResponse({"status": "error", "message": str(e)}, status=400)


def file_stream(file, thread, panel):
    ## Function:
    ## 1. Parse document with unstructured into elements.
    ## 2. Vector encode each element's content.
    ## 3. Save content, page number, and vector encoding to pickle.
    ## 4. Save upload completed as message.
    try:
        ## ----- 1. Parse document with unstructured into elements.
        logger.info("** 1. Parse document with unstructured into elements.")
        yield "Splitting document into chunks..."
        settings = panel.metadata
        ## Remove blank-string keys
        keys_to_remove = [k for k, v in settings.items() if v == ""]
        for key in keys_to_remove:
            del settings[key]
        ## Setup embedding model
        if settings.get("Sentence Transformer Embedding (Local)") not in [None]:
            embedding_model = settings["Sentence Transformer Embedding (Local)"]
            embedding = SentenceTransformer(embedding_model)
        else:
            embedding_model = settings["Embedding Model"]
        logger.info("** Embedding Model: " + str(embedding_model))
        logger.info("** Filepath: " + str(file.filepath))
        ## Partition file
        elements = partition(filename=file.filepath, chunking_strategy="basic")

        ## ----- 2. Vector encode each element's content.
        logger.info("** 2. Vector embed each chunk's content.")
        yield "Vector embedding content..."
        unique_sentences = set()
        sentences = []
        page_numbers = []
        for el in elements:
            page_number = el.metadata.page_number
            sentence = str(el)
            if sentence not in unique_sentences:
                unique_sentences.add(sentence)
                sentences.append(sentence)
                page_numbers.append(page_number)
        ## Prepare embeddings
        if settings.get("Sentence Transformer Embedding (Local)") not in [None]:
            embedded_sentences = embedding.encode(sentences)
        else:
            embedding_settings = {
                "model": embedding_model,
                "api_key": settings.get("API Key"),
                "input": sentences,
            }
            embedding_settings_trimmed = {
                key: value
                for key, value in embedding_settings.items()
                if value is not None
            }
            embedded_response = litellm.embedding(**embedding_settings_trimmed)
            embedded_sentences = [
                sentence["embedding"] for sentence in embedded_response.data
            ]

        ## ----- 3. Save content, page number, and vector encoding to pickle.
        logger.info("** 3. Pickle and save content, page, and embeddings.")
        yield "Saving embeddings..."
        pickle_path = f"{file.filepath}.pkl"
        pickle_data = (sentences, page_numbers, embedded_sentences)
        with open(pickle_path, "wb") as f:
            pickle.dump(pickle_data, f)

        ## ----- 4. Save upload completed as message.
        logger.info("** 4. Save uploaded filepath and store message.")
        filepath_split = file.filepath.split("/")[-1]
        file_message_status = Message(
            content="<strong>{filename}</strong> uploaded and processed successfully. The document context will now be available for use in the chat.".format(
                filename=filepath_split
            ),
            thread=thread,
            panel=panel,
            created_by=file.created_by,
            metadata={
                "sender": "file_upload",
                "file_id": file.id,
                "file_path": file.filepath,
            },
        )
        file_message_status.save()
    except Exception as e:
        logger.error(e, exc_info=True)
        yield "Error: " + str(e)
        # Save error as message
        response_message = Message(
            content="Error: " + str(e),
            thread=thread,
            panel=panel,
            created_by=file.created_by,
            metadata={"sender": "error"},
        )
        response_message.save()


# Message Entrypoint
def message_handler(message, thread, panel):
    try:
        return StreamingHttpResponse(
            chat_stream(message, thread, panel), content_type="text/plain"
        )
    except Exception as e:
        logger.error(e, exc_info=True)
        return JsonResponse({"status": "error", "message": str(e)}, status=400)


def chat_stream(message, thread, panel):
    ## Function:
    ## 1. Get settings.
    ## 2. Enrich incoming message with token_count.
    ## 3. Encode message as question. Retrieve similar document content as context.
    ## 4. Build document context from similar documents.
    ## 5. Build message history (including document context).
    ## 6. Execute chat in a StreamingHttpResponse.
    ## 7. Enrich response message with token_count.
    ## 8. Enrich / append a title to the chat.

    try:
        ## ----- 1. Get settings.
        logger.info("** 1. Preparing settings")
        settings = panel.metadata
        ## Remove blank-string keys
        keys_to_remove = [k for k, v in settings.items() if v == ""]
        for key in keys_to_remove:
            del settings[key]

        ## ----- 2. Enrich incoming message with token_count.
        if settings.get("Token Counter") == "openai":
            completion_model = "gpt-3.5-turbo"
        else:
            completion_model = "huggingface/meta-llama/Llama-2-7b"
        token_count = len(litellm.encode(model=completion_model, text=message.content))
        new_metadata = dict(message.metadata)
        new_metadata["token_count"] = token_count
        message.metadata = new_metadata
        message.save()

        ## ----- 3. Encode message as question. Retrieve similar document content as context.
        logger.info("** 3. Embed message. Retrieve content")
        ## Setup embedding model
        if settings.get("Sentence Transformer Embedding (Local)") not in [None]:
            embedding_model = settings["Sentence Transformer Embedding (Local)"]
            embedding = SentenceTransformer(embedding_model)
        else:
            embedding_model = settings["Embedding Model"]
        logger.info("** Embedding Model: " + str(embedding_model))
        ## Prepare question embedding
        if settings.get("Sentence Transformer Embedding (Local)") not in [None]:
            embedded_message = embedding.encode([message.content])[0]
        else:
            embedding_settings = {
                "model": embedding_model,
                "api_key": settings.get("API Key"),
                "input": [message.content],
            }
            embedding_settings_trimmed = {
                key: value
                for key, value in embedding_settings.items()
                if value is not None
            }
            embedded_response = litellm.embedding(**embedding_settings_trimmed)
            embedded_message = [
                sentence["embedding"] for sentence in embedded_response.data
            ][0]

        files = File.objects.filter(
            created_by=message.created_by, panel_id=panel.id, thread_id=thread.id
        )
        if len(files) > 0:
            sentences = []
            page_numbers = []
            embedded_sentences = []
            associated_filenames = []
            for file in files:
                pickle_path = f"{file.filepath}.pkl"
                with open(pickle_path, "rb") as f:
                    (
                        sentences_data,
                        page_numbers_data,
                        embedded_sentences_data,
                    ) = pickle.load(f)
                sentences.extend(sentences_data)
                page_numbers.extend(page_numbers_data)
                embedded_sentences.extend(embedded_sentences_data)
                associated_filenames.extend(
                    [file.filepath.split("/")[-1]] * len(sentences_data)
                )
            similarities = [
                1 - cosine(embedded_message, embedded_sentence)
                for embedded_sentence in embedded_sentences
            ]
            combined_results = list(
                zip(sentences, page_numbers, associated_filenames, similarities)
            )
            sorted_similarity = sorted(
                combined_results, key=lambda x: x[3], reverse=True
            )
            logger.info("Similarity sample: " + str(sorted_similarity[:5]))

        ## ----- 4. Build document context from similar documents.
        logger.info("** 4. Build document context")
        max_document_tokens = int(settings.get("Document Context"))
        document_token_count = 0
        document_context = ""
        if len(files) > 0:
            for sentence, page_number, filename, similarity in sorted_similarity[:20]:
                sentence_to_add = ""
                sentence_to_add += f"From File: {filename} Context: {sentence} \n"
                sentence_count = len(
                    litellm.encode(model=completion_model, text=sentence_to_add)
                )
                if document_token_count + sentence_count <= max_document_tokens:
                    document_context += sentence_to_add
                    document_token_count += sentence_count
                else:
                    break
        logger.info("Document Context: " + str(document_context))

        ## ----- 5. Build message history (including document context).
        logger.info("** 5. Building message history")
        system_message = settings.get("System Message")
        system_message_token_count = len(
            litellm.encode(model=completion_model, text=system_message)
        )

        # Load jinja template for prompt
        prompt_template = settings.get("Prompt Template")
        prompt_template_token_count = len(
            litellm.encode(model=completion_model, text=prompt_template)
        )

        # Get remaining tokens
        if settings.get("Max Tokens to Generate") is not None:
            remaining_tokens = (
                int(settings.get("Context Size"))
                - prompt_template_token_count
                - document_token_count
                - system_message_token_count
                - int(settings.get("Max Tokens to Generate"))
            )
        else:
            remaining_tokens = (
                int(settings.get("Context Size"))
                - prompt_template_token_count
                - document_token_count
                - system_message_token_count
            )

        # Get Message History
        messages = Message.objects.filter(
            created_by=message.created_by, thread_id=thread.id
        ).order_by("-created_on")
        message_history = []
        message_history_token_count = 0
        user_message_count = 0

        # Prep chat
        for msg in messages:
            if (
                msg.metadata.get("token_count", 0) + message_history_token_count
                <= remaining_tokens
            ):
                if msg.metadata.get("sender", "user") == "user":
                    user_message_count = user_message_count + 1
                    message_history.append({"role": "user", "content": msg.content})
                if msg.metadata.get("sender", "user") == "assistant":
                    message_history.append(
                        {"role": "assistant", "content": msg.content}
                    )
                message_history_token_count += msg.metadata.get("token_count", 0)
            else:
                break
        message_history.reverse()
        logger.info("Message history: " + str(message_history))

        # Create chat
        message_context = {
            "system_message": system_message,
            "document_context": document_context,
            "message_history": message_history,
        }
        template = Template(prompt_template, trim_blocks=True, lstrip_blocks=True)
        message_prepped = template.render(message_context)

        ## ----- 6. Execute chat
        logger.info("** 6. Execute chat")
        logger.info("Message history: " + str(message_prepped))
        client_settings = {
            "api_key": settings.get("API Key"),
            "base_url": (
                settings.get("URL Base", "").rstrip("/")
                if settings.get("URL Base") is not None
                else None
            ),
            "organization": settings.get("Organization ID"),
        }
        client_settings_trimmed = {
            key: value for key, value in client_settings.items() if value is not None
        }
        openai_client = OpenAI(**client_settings_trimmed)
        completion_settings = {
            "stream": True,
            "model": settings.get("Model"),
            "prompt": message_prepped,
            "stop": settings.get("Stop Sequence"),
            "temperature": (
                float(settings.get("Temperature"))
                if settings.get("Temperature") is not None
                else None
            ),
            "max_tokens": (
                int(settings.get("Max Tokens to Generate"))
                if settings.get("Max Tokens to Generate") is not None
                else None
            ),
            "top_p": (
                float(settings.get("Top P"))
                if settings.get("Top P") is not None
                else None
            ),
            "presence_penalty": (
                float(settings.get("Presence Penalty"))
                if settings.get("Presence Penalty") is not None
                else None
            ),
            "frequency_penalty": (
                float(settings.get("Frequency Penalty"))
                if settings.get("Frequency Penalty") is not None
                else None
            ),
        }
        completion_settings_trimmed = {
            key: value
            for key, value in completion_settings.items()
            if value is not None
        }
        response_content = ""
        for part in openai_client.completions.create(**completion_settings_trimmed):
            try:
                delta = part.choices[0].text or ""
                response_content += delta
                yield delta
            except Exception as e:
                logger.info("Skipped chunk: " + str(e))
                pass
        logger.info("response_content: " + str(response_content))
        # Clean content / after last period
        response_content = (
            response_content[: response_content.rfind('."') + 2]
            if response_content.rfind('."') > response_content.rfind(".")
            else response_content[: response_content.rfind(".") + 1]
        )

        ## ----- 7. Enrich response message with token_count.
        logger.info("** 7. Encoding response")
        if settings.get("Token Counter") == "openai":
            completion_model = "gpt-3.5-turbo"
        else:
            completion_model = "huggingface/meta-llama/Llama-2-7b"
        token_count = len(litellm.encode(model=completion_model, text=response_content))
        response_message = Message(
            content=response_content,
            thread=thread,
            panel=panel,
            created_by=message.created_by,
            metadata={"sender": "assistant", "token_count": token_count},
        )
        response_message.save()

        ## ----- 8. Enrich / append a title to the chat.
        # Only add title if first message (+ system message) in history
        logger.info("** 8. Enriching and appending title")
        if user_message_count == 1:
            title_enrich = (
                "## Context: "
                + "You are a bot which condenses text into a succinct and informative title. Please only provide a summary title, do not provide the answer to the question."
                + "\n"
                + "## To summarize: "
                + message.content
                + "\n"
            )
            logger.info("title_enrich: " + str(title_enrich))
            title_settings = {
                "stream": False,
                "model": settings.get("Model"),
                "prompt": title_enrich,
            }
            title_settings_trimmed = {
                key: value for key, value in title_settings.items() if value is not None
            }
            response = openai_client.completions.create(**title_settings_trimmed)
            thread.title = response.choices[0].text.strip('"\n')  # Clean extra quotes
            thread.save()
    except Exception as e:
        logger.error(e, exc_info=True)
        yield "Error: " + str(e)
        # Save error as message
        response_message = Message(
            content="Error: " + str(e),
            thread=thread,
            panel=panel,
            created_by=message.created_by,
            metadata={"sender": "error"},
        )
        response_message.save()
