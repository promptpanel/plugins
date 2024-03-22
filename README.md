<img src="https://promptpanel.com/images/logo.svg" alt="logo" style="width:64px;">

**PromptPanel**\
The Universal AI Interface\
<a href="https://promptpanel.com/docs">Documentation</a> | <a href="https://hub.docker.com/r/promptpanel/promptpanel">DockerHub</a> | <a href="https://github.com/promptpanel/promptpanel">PromptPanel App</a>


## Overview

This repo contains the community plugins found in PromptPanel as well as a sample plugin for your first development.

- The `my-first-plugin` directory gives you some scaffolding for a sample project
- The other community plugins give you references to sample from.
- The `docker-compose.yml` file gives you a sample with the various mounts and environment variables we recommend for development.


To get more information about how to build your first plugin we recommend giving a read to: 

- <a href="https://promptpanel.com/plugin-authoring/building-plugins/" target="_new">Building Plugins</a>
- <a href="https://promptpanel.com/overview/data-model/" target="_new">Data Model</a>

## Development

Running `docker compose up` from this directory will bring up a development environment you can use to start developing your Plugin.

```bash
docker compose up
```

You may want to re-map your port from `4000` if you have another PromptPanel instance running.

```yaml
version: "3.9"
services:
  promptpanel:
    image: promptpanel/promptpanel:latest
    container_name: promptpanel_development
    restart: always
    ports:
      - 4000:4000
    volumes:
      ## Community plugins
      - ./completion_chat:/app/plugins/completion_chat
      - ./completion_document:/app/plugins/completion_document
      - ./ollama_chat:/app/plugins/ollama_chat
      - ./ollama_document:/app/plugins/ollama_document
      - ./llm_chat:/app/plugins/llm_chat
      - ./llm_document:/app/plugins/llm_document
      ## Your new plugins
      - ./my-first-plugin:/app/plugins/my-first-plugin
    environment:
      PROMPT_MODE: DEVELOPMENT ## Applies changes server-side as you work.
      PROMPT_DEV_INSTALL_REQS: ENABLED ## Installs requirements on container startup.
      PROMPT_OLLAMA_HOST: http://ollama:11434
  ## Ollama is optional for local inference.
  ## You can remove this service & the `PROMPT_OLLAMA_HOST` environment variable in order to disable local inference.
  ollama: 
    image: ollama/ollama:latest
    container_name: ollama
    restart: always
```
