var pluginState = () => {
  return {
    // Mobile
    mobileOpen: false,
    // Threads
    activeThread: {},
    threadSearchInput: "",
    threads: [],
    // Model Select
    isOllama: false,
    ollamaModels: [],
    activeOllamaModel: false,
    ollamaNotFoundError: false,
    selectedOllamaModel: null,
    // Messages
    messages: [],
    responseStream: "",
    messageFormatted: "",
    messageFromEditor: "",
    // Message UI
    osPlatform: "",
    quillFocused: false,
    quillEditor: null,
    // Files
    fileStream: "",
    uploadedFilePath: null,
    extractedFilename: "",
    // Modals
    modalSelectModel: false,
    modalThreadEdit: false,
    modalMessageEdit: false,
    modalMessageId: 0,
    threadNameForUpdate: "",
    messageForUpdate: "",
    // Indicators
    indicateProcessing: false,
    // Page-load Redirects
    redirectMessage() {
      panelId = Alpine.store("active").panelId;
      threadId = Alpine.store("active").threadId;
      hostname = window.location.origin;
      let redirectUrl = null;
      if (panelId && threadId) {
        redirectUrl = `${hostname}/panel/${this.panelId}/${this.threadId}/`;
      }
      if (panelId && !threadId) {
        redirectUrl = `${hostname}/panel/${this.panelId}/`;
      }
      if (!panelId) {
        redirectUrl = `${hostname}/panel/not-found/`;
      }
      window.location.href = redirectUrl;
    },
    redirectPanel() {
      const panelId = Alpine.store("active").panelId;
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/threads/panel/" + panelId + "/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          this.threads = data;
          // Create a new thread if none exist
          if (this.threads.length === 0) {
            this.createThread();
          } else {
            const maxThread = this.threads.reduce((prev, current) => (prev.id > current.id ? prev : current));
            window.location.href = "/panel/" + Alpine.store("active").panelId + "/" + maxThread.id + "/";
          }
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem retrieving your threads. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    // Models
    getModels() {
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/ollama/tags";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          this.ollamaModels = data.models;
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem retrieving your models. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    setModel(showToast = true) {
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/thread/update/" + Alpine.store("active").threadId + "/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      const threadData = {
        metadata: { ollamaModel: this.selectedOllamaModel },
      };
      fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
        body: JSON.stringify(threadData),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status === "success") {
            if (showToast) {
              successToast = {
                type: "success",
                header: "Your model has been updated.",
              };
              Alpine.store("toastStore").addToast(successToast);
            }
            this.getThreads();
            this.getModels();
            this.modalSelectModel = false;
          }
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem updating your model. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    // Threads
    createThread() {
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/thread/create/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      const threadData = {
        title: "New Thread",
        panel_id: Alpine.store("active").panelId,
      };
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
        body: JSON.stringify(threadData),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status === "success") {
            window.location.href = "/panel/" + Alpine.store("active").panelId + "/" + data.id + "/";
          } else {
            console.error(data);
            failToast = {
              type: "error",
              header: "We had a problem creating your thread. Please try again.",
              message: data.message,
            };
            Alpine.store("toastStore").addToast(failToast);
          }
        })
        .catch((error) => {
          console.error(error);
          failToast = {
            type: "error",
            header: "We had a problem creating your thread. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    getThreads() {
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/threads/panel/" + Alpine.store("active").panelId + "/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          this.threads = data;
          // Create a new thread if none exist
          if (this.threads.length === 0) {
            this.createThread();
          }
          this.setActiveThread();
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem retrieving your threads. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    deleteThread() {
      if (!confirm("Are you sure you want to delete this thread?")) {
        return;
      }
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/thread/delete/" + Alpine.store("active").threadId + "/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status === "success") {
            window.location.href = "/panel/" + Alpine.store("active").panelId + "/?deleted=true";
          } else {
            failToast = {
              type: "error",
              header: "We had a problem deleting your thread. Please try again.",
              message: data.message,
            };
            Alpine.store("toastStore").addToast(failToast);
          }
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem deleting your thread. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    updateThread() {
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/thread/update/" + Alpine.store("active").threadId + "/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      const threadData = {
        title: this.threadNameForUpdate,
      };
      fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
        body: JSON.stringify(threadData),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status === "success") {
            successToast = {
              type: "success",
              header: "Your thread has been updated.",
            };
            Alpine.store("toastStore").addToast(successToast);
            this.getThreads();
            this.modalThreadEdit = false;
          }
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem updating your thread. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    cloneThread() {
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/thread/clone/" + Alpine.store("active").threadId + "/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status === "success") {
            successToast = {
              type: "success",
              header: "Your thread has been duplicated.",
            };
            Alpine.store("toastStore").addToast(successToast);
            this.getThreads();
          }
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem updating your thread. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    retryThread() {
      if (!confirm("Are you sure you want to trye this thread (your last message will be replaced)?")) {
        return;
      }
      let mdConverter = new showdown.Converter();
      // Streaming container for WIP generation
      let streaming = "";
      // Prune the last message locally in order to retry creating
      let maxId = -1;
      this.messages.forEach((message) => {
        if (message.id > maxId) maxId = message.id;
      });
      this.messages = this.messages.filter((message) => message.id !== maxId);
      this.indicateProcessing = true;
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/thread/retry/" + Alpine.store("active").threadId + "/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
      })
        .then((response) => {
          if (!response.ok) {
            response.text().then(errorMessage => {
              failToast = {
                type: "error",
                header: "We had a problem retrieving your messages. Please try again.",
                message: errorMessage,
              };
              Alpine.store("toastStore").addToast(failToast);
            });
            return;
          }
          const reader = response.body.getReader();
          return new ReadableStream({
            start: (controller) => {
              const push = () => {
                reader
                  .read()
                  .then(({ done, value }) => {
                    if (done) {
                      controller.close();
                      this.indicateProcessing = false;
                      this.responseStream = "";
                      this.getMessages();
                      return;
                    }
                    const string = new TextDecoder().decode(value);
                    streaming += string;
                    // Format for display / light sanitize for HTML tags and such
                    this.responseStream = mdConverter.makeHtml(streaming);
                    controller.enqueue(value);
                    push();
                  })
                  .catch((error) => {
                    this.indicateRetryLoading = false;
                    failToast = {
                      type: "error",
                      header: "We had a problem retrieving your message response. Please try again.",
                      message: error.message,
                    };
                    Alpine.store("toastStore").addToast(failToast);
                  });
              };
              push();
            },
          });
        })
        .then((stream) => new Response(stream))
        .then((response) => response.text())
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem deleting your thread. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    get filteredThreads() {
      if (this.threadSearchInput === "") {
        return this.threads;
      }
      return this.threads.filter((thread) => thread.title.toLowerCase().includes(this.threadSearchInput.toLowerCase()));
    },
    setActiveThread() {
      // Scroll placement
      setTimeout(() => {
        const sidebar = document.getElementById("sidebar");
        const activeLink = document.getElementById("active-link");
        if (activeLink) {
          const topPos = activeLink.offsetTop;
          sidebar.scrollTop = topPos - sidebar.offsetTop - 84;
        }
      }, 80);
      // Load thread
      this.activeThread = this.threads.find((thread) => thread.id === Alpine.store("active").threadId) || {};
      if (typeof this.activeThread.metadata === "string") {
        try {
          this.activeThread.metadata = JSON.parse(this.activeThread.metadata);
        } catch (e) {
          console.warn("Error parsing thread metadata:", e);
          this.activeThread.metadata = {};
        }
      }
      // Set Ollama active model / default model
      if(Alpine.store("active").isOllama) {
        this.activeOllamaModel = this.activeThread.metadata && this.activeThread.metadata.ollamaModel ? this.activeThread.metadata.ollamaModel : null;
        setTimeout(() => {
          if (!this.activeThread.metadata || !this.activeThread.metadata.ollamaModel) {
            // Update missing model
            if (this.ollamaModels) {
              this.selectedOllamaModel = this.ollamaModels[0].name;
              this.setModel(false);
            }
          } else {
            // Check active model vs ollama stack
            if (this.activeOllamaModel !== null) {
              const modelFound = this.ollamaModels.some((model) => model.name === this.activeOllamaModel);
              if (!modelFound) {
                this.ollamaNotFoundError = true;
              }
            }
          }
        }, 80);  
      }
    },
    // Messages
    createMessageSubmit() {
      // Streaming container for WIP generation
      let streaming = "";
      let mdConverter = new showdown.Converter();
      this.messageFormatted = mdConverter.makeHtml(this.messageFromEditor);
      this.setupQuill();
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/message/create/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      const threadData = {
        content: this.messageFromEditor,
        metadata: { sender: "user" },
        panel_id: Alpine.store("active").panelId,
        thread_id: Alpine.store("active").threadId,
      };
      // Wipe interim message before sending
      this.messageFromEditor = "";
      // Indicate processing => positioning div
      this.indicateProcessing = true;
      setTimeout(() => {
        document.getElementById("processingChat").scrollIntoView();
      }, 80);
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
        body: JSON.stringify(threadData),
      })
        .then((response) => {
          const reader = response.body.getReader();
          return new ReadableStream({
            start: (controller) => {
              const push = () => {
                reader
                  .read()
                  .then(({ done, value }) => {
                    if (done) {
                      controller.close();
                      this.indicateProcessing = false;
                      this.messageFormatted = "";
                      this.responseStream = "";
                      this.getMessages();
                      this.getThreads();
                      return;
                    }
                    const string = new TextDecoder().decode(value);
                    streaming += string;
                    // Format for display / light sanitize for HTML tags and such
                    this.responseStream = mdConverter.makeHtml(streaming);
                    controller.enqueue(value);
                    push();
                  })
                  .catch((error) => {
                    failToast = {
                      type: "error",
                      header: "We had a problem retrieving your message response. Please try again.",
                      message: error.message,
                    };
                    Alpine.store("toastStore").addToast(failToast);
                  });
              };
              push();
            },
          });
        })
        .then((stream) => new Response(stream))
        .then((response) => response.text())
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem retrieving your message response. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    getMessages() {
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/messages/thread/" + Alpine.store("active").threadId + "/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          this.messages = data;
          this.newMessage = "";
          this.newRawMessage = "";
          setTimeout(() => {
            hljs.highlightAll();
            document.querySelector("#content-area").scrollTop = document.querySelector("#content-area").scrollHeight;
          }, 80);
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem retrieving your messages. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    deleteMessage(messageId) {
      if (!confirm("Are you sure you want to delete this message?")) {
        return;
      }
      const hostname = window.location.origin;
      const url = `${hostname}/api/v1/app/message/delete/${messageId}/`;
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status === "success") {
            successToast = {
              type: "success",
              header: "Successfully deleted your message.",
            };
            Alpine.store("toastStore").addToast(successToast);
            this.getMessages();
            this.modalMessageEdit = false;
          } else {
            failToast = {
              type: "error",
              header: "We had a problem deleting your message. Please try again.",
              message: data.message,
            };
            Alpine.store("toastStore").addToast(failToast);
          }
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem deleting your message. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    updateMessage(messageId) {
      const hostname = window.location.origin;
      const url = `${hostname}/api/v1/app/message/update/${messageId}/`;
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      const messageData = {
        content: this.messageForUpdate,
      };
      fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
        body: JSON.stringify(messageData),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status === "success") {
            successToast = {
              type: "success",
              header: "Your message has been updated.",
            };
            Alpine.store("toastStore").addToast(successToast);
            this.getMessages();
            this.modalMessageEdit = false;
          }
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem updating your message. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    // Files
    createFileSubmit() {
      // Prep File
      let mdConverter = new showdown.Converter();
      let fileStatus = "";
      const fileInput = document.getElementById("file-upload");
      const uploadedFile = fileInput.files[0];
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("panel_id", Alpine.store("active").panelId);
      formData.append("thread_id", Alpine.store("active").threadId);
      const hostname = window.location.origin;
      const url = hostname + "/api/v1/app/file/create/";
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      // Wipe interim filename before sending
      this.extractedFilename = "";
      this.indicateProcessing = true;
      setTimeout(() => {
        document.getElementById("processingChat").scrollIntoView();
      }, 80);
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + authToken,
        },
        body: formData,
      })
        .then((response) => {
          const reader = response.body.getReader();
          return new ReadableStream({
            start: (controller) => {
              const push = () => {
                reader
                  .read()
                  .then(({ done, value }) => {
                    if (done) {
                      controller.close();
                      this.indicateProcessing = false;
                      this.fileStream = "";
                      this.clearFilename();
                      this.getMessages();
                      this.getThreads();
                      return;
                    }
                    const string = new TextDecoder().decode(value);
                    fileStatus = string;
                    // Format for display / light sanitize for HTML tags and such
                    this.fileStream = mdConverter.makeHtml(fileStatus);
                    controller.enqueue(value);
                    push();
                  })
                  .catch((error) => {
                    failToast = {
                      type: "error",
                      header: "We had a problem parsing and embedding your file. Please try again.",
                      message: error.message,
                    };
                    Alpine.store("toastStore").addToast(failToast);
                  });
              };
              push();
            },
          });
        })
        .then((stream) => new Response(stream))
        .then((response) => response.text())
        .catch((error) => {
          this.clearFilename();
          failToast = {
            type: "error",
            header: "We had a problem parsing and embedding. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    deleteFile(messageId, fileId) {
      if (!confirm("Are you sure you want to delete this file?")) {
        return;
      }
      const hostname = window.location.origin;
      const authToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authToken="))
        .split("=")[1];
      const fileUrl = `${hostname}/api/v1/app/file/delete/${fileId}/`;
      fetch(fileUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          // Delete informational message about the file as well
          const messsageUrl = `${hostname}/api/v1/app/message/delete/${messageId}/`;
          if (data.status === "success") {
            fetch(messsageUrl, {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + authToken,
              },
            })
              .then((response) => response.json())
              .then((data) => {
                if (data.status === "success") {
                  successToast = {
                    type: "success",
                    header: "Successfully deleted your file.",
                  };
                  Alpine.store("toastStore").addToast(successToast);
                  this.getMessages();
                  this.modalMessageEdit = false;
                } else {
                  failToast = {
                    type: "error",
                    header: "We had a problem deleting your file. Please try again.",
                    message: data.message,
                  };
                  Alpine.store("toastStore").addToast(failToast);
                }
              })
              .catch((error) => {
                failToast = {
                  type: "error",
                  header: "We had a problem deleting your file. Please try again.",
                  message: error.message,
                };
                Alpine.store("toastStore").addToast(failToast);
              });
          } else {
            failToast = {
              type: "error",
              header: "We had a problem deleting your file. Please try again.",
              message: data.message,
            };
            Alpine.store("toastStore").addToast(failToast);
          }
        })
        .catch((error) => {
          failToast = {
            type: "error",
            header: "We had a problem deleting your file. Please try again.",
            message: error.message,
          };
          Alpine.store("toastStore").addToast(failToast);
        });
    },
    // Utilities
    setupQuill() {
      // Wipe if exists
      let quillContainer = document.querySelector("#quill");
      if (quillContainer.classList.contains("ql-container")) {
        quillContainer.innerHTML = "";
      }
      // Initialize
      let quillEditor = new Quill("#quill", {
        placeholder: "Enter your message here...",
      });
      // Hotkey send
      let editorTextarea = document.querySelector("#quill .ql-editor");
      editorTextarea.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.keyCode === 13) {
          event.preventDefault();
          if (this.extractedFilename !== "") {
            this.createFileSubmit();
          } else {
            this.createMessageSubmit();
          }
        }
      });
      // Focus styles
      quillEditor.on("editor-change", (eventName, ...args) => {
        if (eventName === "selection-change") {
          const [range] = args;
          if (range) {
            this.quillFocused = true;
          } else {
            this.quillFocused = false;
          }
        }
      });
      quillEditor.on("text-change", () => {
        const content = quillEditor.getText();
        this.messageFromEditor = content.trim();
      });
    },
    updateQuill(message) {
      if (message !== this.quillEditor.getText()) {
        this.quillEditor.off("text-change");
        this.quillEditor.clipboard.dangerouslyPasteHTML(message);
        this.quillEditor.on("text-change", () => {
          const content = this.quillEditor.getText();
          this.messageFromEditor = content.trim();
        });
      }
    },
    isLastAssistantMessage(messageId) {
      let lastAssistantMessageId = this.messages.reduce((lastId, current) => {
        return current.metadata?.sender == "assistant" ? current.id : lastId;
      }, null);
      return messageId === lastAssistantMessageId;
    },
    extractFilename() {
      if (!this.uploadedFilePath) {
        this.extractedFilename = "";
      }
      var parts = this.uploadedFilePath.split("\\");
      this.extractedFilename = parts[parts.length - 1];
    },
    clearFilename() {
      document.getElementById("file-upload").value = null;
      this.uploadedFilePath = null;
      this.extractedFilename = "";
    },
    formatDate: function (datetime) {
      const date = new Date(datetime); // parse the datetime string into a Date object
      const year = date.getFullYear();
      const month = ("0" + (date.getMonth() + 1)).slice(-2); // getMonth() returns 0-11, so we add 1
      const day = ("0" + date.getDate()).slice(-2); // getDate() returns the day of the month
      const hour = ("0" + (date.getHours() > 12 ? date.getHours() - 12 : date.getHours())).slice(-2); // getHours() returns the hour (0-23), convert to 12-hour format
      const minute = ("0" + date.getMinutes()).slice(-2); // getMinutes() returns the minute (0-59)
      const ampm = date.getHours() >= 12 ? "PM" : "AM";
      return `${year}/${month}/${day} at ${hour}:${minute}${ampm}`;
    },
    getOS() {
      let platform = window.navigator.platform;
      if (/^Mac/.test(platform)) {
        this.osPlatform = "mac";
      } else if (/^Win/.test(platform)) {
        this.osPlatform = "windows";
      } else {
        this.osPlatform = "other";
      }
    },
  };
};

// Querystring
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("deleted") === "true") {
    successToast = {
      type: "success",
      header: "Thread deleted successfully",
      message: "Your thread was deleted successfully.",
    };
    Alpine.store("toastStore").addToast(successToast);
  }
});

// Format copy for quill
function getTextWithLineBreaks(element) {
  let text = "";
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === "BR") {
        text += "\n";
      } else if (["P", "DIV", "TR", "LI"].includes(node.tagName)) {
        text += getTextWithLineBreaks(node) + "\n";
      } else {
        text += getTextWithLineBreaks(node);
      }
    }
  }
  return text;
}
document.addEventListener("copy", function (event) {
  var selectedText = window.getSelection();
  if (selectedText.isCollapsed && (document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "INPUT")) {
    // Allow default copy behavior for textarea and input fields
    return;
  }
  event.preventDefault();
  var textToCopy = "";
  for (let i = 0; i < selectedText.rangeCount; i++) {
    var range = selectedText.getRangeAt(i);
    var clonedSelection = range.cloneContents();
    var div = document.createElement("div");
    div.appendChild(clonedSelection);
    textToCopy += getTextWithLineBreaks(div);
  }
  event.clipboardData.setData("text/plain", textToCopy.trim());
});
