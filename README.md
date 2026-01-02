# PrivacyAI 🛡️

**PrivacyAI** is a private, local-first AI assistant that runs entirely in your browser. It uses Google Chrome's built-in Gemini Nano model to provide Chat, Writing, and Editing capabilities without sending a single byte of your data to the cloud.

![PrivacyAI Screenshot](https://via.placeholder.com/800x400?text=PrivacyAI+Dashboard)

## 🚀 Key Features

*   **100% Private**: Your chats, drafts, and data are stored locally in your browser's IndexedDB. Nothing leaves your device.
*   **Offline Capable**: Once the model is downloaded, the app works without an internet connection.
*   **Multi-Mode AI**:
    *   **Chat**: General purpose assistant.
    *   **Writer**: Generate emails, articles, and stories.
    *   **Editor**: Fix grammar, rephrase text, and improve style.
*   **Localized**: Fully translated into English, Lithuanian, Polish, German, Spanish, and Japanese.
*   **PWA Support**: Installable as a native-like app on your desktop.

## 🛠️ Requirements

PrivacyAI relies on experimental AI APIs available in **Chrome Canary** (or Dev).

*   **Browser**: [Chrome Canary](https://www.google.com/chrome/canary/) (Version 128+)
*   **Hardware**: A device capable of running Gemini Nano (most modern laptops/desktops).

## ⚙️ Setup Guide

To enable the local AI, you must configure a few browser flags:

1.  Open `chrome://flags` in a new tab.
2.  Search for and **Enable** the following:
    *   `Enables optimization guide on device`: set to **Enabled BypassPerfRequirement**
    *   `Prompt API for Gemini Nano`: **Enabled**
    *   `Writer API for Gemini Nano`: **Enabled**
    *   `Rewriter API for Gemini Nano`: **Enabled**
3.  **Restart Chrome**.
4.  Open `chrome://components`.
5.  Find **Optimization Guide On Device Model** and click **Check for Update**.
    *   *Note: If the version is `0.0.0.0`, it is still downloading the model (approx 1-2GB). Wait for it to show a valid version number.*

## 🏃 Running Locally

To run the project on your machine:

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/PrivacyAI.git
    cd PrivacyAI
    ```
2.  Start a simple HTTP server (Python example):
    ```bash
    python -m http.server 8000
    ```
3.  Open `http://localhost:8000` in Chrome Canary.

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/NewFeature`).
3.  Commit your changes.
4.  Push to the branch.
5.  Open a Pull Request.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

**Note**: This is an experimental project using Early Preview APIs. Functionality may change as Chrome evolves.
