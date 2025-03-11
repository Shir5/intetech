import templateHTML from '../template/file-uploader.template.html?raw';
import axios from 'axios';

export class FileUploader extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.uploadUrl = 'https://file-upload-server-mc26.onrender.com/api/v1/upload';
    }

    // Когда элемент добавляется в DOM, клонируем шаблон и вешаем события
    connectedCallback() {
        const template = document.createElement('template');
        template.innerHTML = templateHTML;
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.bindEvents();

        this.mainCloseButton = this.shadowRoot.getElementById('mainCloseButton');
        this.mainCloseButton.addEventListener('click', () => this.handleMainClose());
    }

    // Собираем все элементы и вешаем слушатели событий
    bindEvents() {
        this.form = this.shadowRoot.getElementById('uploadForm');
        this.nameInput = this.shadowRoot.getElementById('nameInput');
        this.inputContainer = this.shadowRoot.getElementById('inputContainer');
        this.fileInput = this.shadowRoot.getElementById('fileInput');
        this.uploadBtn = this.shadowRoot.getElementById('uploadBtn');
        this.loadingContainer = this.shadowRoot.getElementById('loadingContainer');
        this.fileInputContainer = this.shadowRoot.getElementById('fileInputContainer');
        this.loadingMessage = this.shadowRoot.querySelector('#loadingInfo p');
        this.messageBox = this.shadowRoot.getElementById('messageBox');
        this.closeButton = this.shadowRoot.getElementById('closeButton');
        this.loadingCloseButton = this.shadowRoot.getElementById('loadingCloseButton');

        // Очищаем поле имени при вводе или по клику на кнопку
        this.nameInput.addEventListener('input', () => {
            this.validateForm();
            this.loadingMessage.textContent = this.nameInput.value.trim();
        });
        this.closeButton.addEventListener('click', () => {
            this.nameInput.value = '';
            this.validateForm();
        });

        // Кнопка для отмены выбранного файла
        this.loadingCloseButton.addEventListener('click', () => {
            this.fileInput.value = '';
            this.nameInput.value = '';

            this.inputContainer.classList.remove('invisible');
            this.loadingContainer.classList.add('hidden');
            this.fileInputContainer.classList.remove('shift-up', 'dragging');

            const progressBar = this.shadowRoot.getElementById('progressBar');
            const progressText = this.shadowRoot.getElementById('progressText');
            progressBar.value = 0;
            progressText.textContent = '0%';

            this.form.classList.remove('shrink', 'hide-elements', 'success', 'error');

            this.clearMessage();

            this.fileInput.disabled = false;
            this.nameInput.disabled = false;

            this.validateForm();
        });

        // События загрузки файла и отправки формы
        this.fileInput.addEventListener('change', (event) => this.handleFileChange(event));
        this.form.addEventListener('submit', (event) => this.handleSubmit(event));

        // События drag/drop на контейнер
        this.fileInputContainer.addEventListener('dragenter', (event) => this.handleDragEnter(event));
        this.fileInputContainer.addEventListener('dragover', (event) => this.handleDragOver(event));
        this.fileInputContainer.addEventListener('dragleave', (event) => this.handleDragLeave(event));
        this.fileInputContainer.addEventListener('drop', (event) => this.handleDrop(event));
    }

    // Валидация формы
    validateForm() {
        this.clearMessage();
        const nameValid = this.nameInput.value.trim().length > 0;
        const fileValid = this.fileInput.files && this.fileInput.files.length > 0;
        this.uploadBtn.disabled = !(nameValid && fileValid);
    }

    // Обработка изменения файла
    handleFileChange(event) {
        this.clearMessage();
        this.inputContainer.classList.add('invisible');
        this.fileInputContainer.classList.remove('highlighted');

        const file = event.target.files[0];
        if (!file) {
            this.uploadBtn.disabled = true;
            this.inputContainer.classList.remove('invisible');
            return;
        }

        const allowedExtensions = ['txt', 'json', 'csv'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            this.showMessage({ message: 'Неверный формат файла. Разрешены только .txt, .json, .csv' }, 'error');
            this.fileInput.value = '';
            this.uploadBtn.disabled = true;
            this.inputContainer.classList.remove('invisible');
            return;
        }

        if (file.size > 1024) {
            this.form.classList.remove("success");
            this.form.classList.add("error");
            this.form.classList.add("shrink");
            this.form.classList.add("hide-elements");

            this.showMessage({ message: 'Размер файла превышает 1024 KB.' }, 'error');
            this.fileInput.value = '';
            this.uploadBtn.disabled = true;
            this.inputContainer.classList.remove('invisible');
            return;
        }

        // Если имя не задано, берём из файла
        if (!this.nameInput.value.trim()) {
            this.nameInput.value = file.name;
        }

        this.loadingMessage.textContent = this.nameInput.value.trim();
        this.fileInputContainer.classList.add('shift-up');
        this.validateForm();

        setTimeout(() => {
            this.loadingContainer.classList.remove('hidden');
            this.uploadBtn.disabled = true;

            this.startProgressAnimation();
        }, 500);
    }

    // Обработка перетаскивания файла
    handleDrop(event) {
        event.preventDefault();
        this.clearMessage();
        this.fileInputContainer.classList.remove('dragging');

        const files = event.dataTransfer.files;
        if (!files || !files.length) return;

        const file = files[0];

        // Те же проверки, что и при обычном выборе файла
        const allowedExtensions = ['txt', 'json', 'csv'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            this.form.classList.remove("success");
            this.form.classList.add("error", "shrink", "hide-elements");

            this.showMessage({ message: 'Неверный формат файла. Разрешены только .txt, .json, .csv' }, 'error');
            this.fileInput.value = '';
            this.uploadBtn.disabled = true;
            this.inputContainer.classList.remove('invisible');
            return;
        }

        if (file.size > 1024) {
            this.form.classList.remove("success");
            this.form.classList.add("error", "shrink", "hide-elements");

            this.showMessage({ message: 'Размер файла превышает 1024 KB.' }, 'error');
            this.fileInput.value = '';
            this.uploadBtn.disabled = true;
            this.inputContainer.classList.remove('invisible');
            return;
        }

        if (!this.nameInput.value.trim()) {
            this.nameInput.value = file.name;
        }

        this.inputContainer.classList.add('invisible');
        this.fileInputContainer.classList.add('shift-up');

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        this.fileInput.files = dataTransfer.files;

        this.loadingMessage.textContent = this.nameInput.value.trim();

        this.validateForm();

        setTimeout(() => {
            this.loadingContainer.classList.remove('hidden');
            this.uploadBtn.disabled = true;

            this.startProgressAnimation();
        }, 500);
    }

    // Подсвечивание блока при перетаскивании
    handleDragEnter(event) {
        this.fileInputContainer.classList.add('dragging');
    }

    handleDragOver(event) {
        event.preventDefault();
    }

    handleDragLeave(event) {
        this.fileInputContainer.classList.remove('dragging');
    }

    // Имитация загрузки
    startProgressAnimation() {
        this.loadingContainer.classList.remove('hidden');
        const progressBar = this.shadowRoot.getElementById('progressBar');
        const progressText = this.shadowRoot.getElementById('progressText');

        progressBar.value = 0;
        progressText.textContent = '0%';

        const duration = 1000;
        const interval = 100;
        const step = 100 / (duration / interval);

        let currentProgress = 0;
        const intervalId = setInterval(() => {
            currentProgress += step;
            if (currentProgress >= 100) {
                currentProgress = 100;
                clearInterval(intervalId);
                this.uploadBtn.disabled = false;
            }
            progressBar.value = currentProgress;
            progressText.textContent = `${Math.round(currentProgress)}%`;
        }, interval);
    }

    async handleSubmit(event) {
        event.preventDefault();
        this.clearMessage();

        // На время загрузки блокируем поля и кнопку
        this.uploadBtn.disabled = true;
        this.nameInput.disabled = true;
        this.fileInput.disabled = true;

        const file = this.fileInput.files[0];
        const customName = this.nameInput.value.trim();

        // Составляем FormData и шлём на сервер
        const formData = new FormData();
        formData.append('name', customName || file.name);
        formData.append('file', file);

        try {
            const response = await axios.post(this.uploadUrl, formData);
            const result = response.data;

            this.form.classList.remove("error");
            this.form.classList.add("success", "shrink", "hide-elements");

            // Вывод информации
            this.showMessage({
                name: result.nameField || customName || file.name,
                filename: result.filename || file.name,
                timestamp: result.timestamp,
                message: result.message
            }, 'success');
        } catch (error) {
            // Обработка ошибок
            this.form.classList.remove("success");
            this.form.classList.add("error", "shrink", "hide-elements");

            let errorMessage = 'Ошибка при загрузке файла.';
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText || '';
                let messageDetail = error.response.data.error || '';
                if (status === 500 && error.response.data.details) {
                    messageDetail += `: ${error.response.data.details}`;
                }
                errorMessage = `Error: ${status} ${statusText}\n“${messageDetail}”`;
            } else {
                errorMessage = error.message || errorMessage;
            }

            this.showMessage({
                name: '',
                filename: '',
                timestamp: '',
                message: errorMessage
            }, 'error');
        } finally {
            this.uploadBtn.disabled = false;
            this.nameInput.disabled = false;
            this.fileInput.disabled = false;
        }
    }

    // Очистка messageBox
    clearMessage() {
        this.messageBox.textContent = '';
        this.messageBox.classList.add('hidden');
    }

    // Показать сообщение в блоке messageBox
    showMessage(data, type) {
        if (!this.messageBox) {
            this.messageBox = this.shadowRoot.getElementById('messageBox');
        }
        if (!this.uploadForm) {
            this.uploadForm = this.shadowRoot.getElementById('uploadForm');
        }
        if (!this.uploadFormInitialBackground) {
            this.uploadFormInitialBackground = getComputedStyle(this.uploadForm).background;
        }

        // Генерируем HTML для ошибки или успеха
        if (type === 'error') {
            this.messageBox.innerHTML = `
                <h1>Ошибка загрузки</h1>
                <p>
                    <strong>message:</strong> ${data.message || 'Нет сообщения'}
                </p>
            `;
        } else {
            this.messageBox.innerHTML = `
                <h1>Файл успешно загружен!</h1>
                <p>
                    name: ${data.name || 'Безымянный'}<br>
                    filename: ${data.filename || 'неизвестный'}<br>
                    timestamp: ${data.timestamp || '00:00:00'}<br>
                    message: ${data.message || 'Нет сообщения'}
                </p>
            `;
        }

        // Показываем блок messageBox с нужными стилями
        this.messageBox.className = 'visible ' + (type === 'success' ? 'msg-success' : 'msg-error');

        // Меняем фон формы на градиент успеха или ошибки
        if (type === 'success') {
            this.uploadForm.style.background = 'linear-gradient(rgba(95, 92, 240, 1), rgba(143, 141, 244, 1))';
        } else {
            this.uploadForm.style.background = 'linear-gradient(rgba(240, 92, 92, 1), rgba(143, 141, 244, 1))';
        }
    }

    // Обработчик закрытия формы (приводит ее в исходное состояние)
    handleMainClose() {
        if (this.hideMessageTimeout) {
            clearTimeout(this.hideMessageTimeout);
        }
        this.messageBox.classList.add('hidden');
        this.fileInputContainer.classList.remove('shift-up');
        this.inputContainer.classList.remove('invisible');
        this.loadingContainer.classList.add('hidden');
        this.uploadForm.style.background = this.uploadFormInitialBackground;
        this.uploadForm.classList.remove('shrink');
        setTimeout(() => {
            this.uploadForm.classList.remove('hide-elements');
        }, 500);
    }
}

// Регистрируем кастомный элемент
customElements.define('file-uploader', FileUploader);
