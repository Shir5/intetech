import templateHTML from '../template/file-uploader.template.html?raw';
import axios from 'axios';

export class FileUploader extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.uploadUrl = 'https://file-upload-server-mc26.onrender.com/api/v1/upload';
        this.dropInProgress = false;
    }

    connectedCallback() {
        const template = document.createElement('template');
        template.innerHTML = templateHTML;
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.bindEvents();
    }

    bindEvents() {
        this.form = this.shadowRoot.getElementById('uploadForm');
        this.nameInput = this.shadowRoot.getElementById('nameInput');
        this.mainCloseButton = this.shadowRoot.getElementById('mainCloseButton');
        this.inputContainer = this.shadowRoot.getElementById('inputContainer');
        this.fileInput = this.shadowRoot.getElementById('fileInput');
        this.uploadBtn = this.shadowRoot.getElementById('uploadBtn');
        this.loadingContainer = this.shadowRoot.getElementById('loadingContainer');
        this.fileInputContainer = this.shadowRoot.getElementById('fileInputContainer');
        this.loadingMessage = this.shadowRoot.querySelector('#loadingInfo p');
        this.messageBox = this.shadowRoot.getElementById('messageBox');
        this.closeButton = this.shadowRoot.getElementById('closeButton');
        this.loadingCloseButton = this.shadowRoot.getElementById('loadingCloseButton');

        // Закрытие формы 
        this.mainCloseButton.addEventListener('click', () => this.handleMainClose());

        // Очистка поля имени при вводе
        this.nameInput.addEventListener('input', () => {
            this.validateForm();
            this.loadingMessage.textContent = this.nameInput.value.trim();
        });

        // Кнопка очистки имени
        this.closeButton.addEventListener('click', () => {
            this.nameInput.value = '';
            this.validateForm();
        });

        // Кнопка для отмены выбранного файла
        this.loadingCloseButton.addEventListener('click', () => this.resetFormState());

        // Изменение файла через <input type="file">
        this.fileInput.addEventListener('change', (event) => this.handleFileChange(event));

        // Отправка формы
        this.form.addEventListener('submit', (event) => this.handleSubmit(event));

        // Drag & drop
        this.fileInputContainer.addEventListener('dragenter', (event) => this.handleDragEnter(event));
        this.fileInputContainer.addEventListener('dragover', (event) => this.handleDragOver(event));
        this.fileInputContainer.addEventListener('dragleave', (event) => this.handleDragLeave(event));
        this.fileInputContainer.addEventListener('drop', (event) => this.handleDrop(event));
    }

    // Общий метод валидации
    validateFile(file) {
        if (!file) {
            return 'Файл не обнаружен.';
        }

        // Разрешённые расширения
        const allowedExtensions = ['txt', 'json', 'csv'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            return 'Неверный формат файла. Разрешены только .txt, .json, .csv';
        }

        if (file.size > 1024) {
            return 'Размер файла превышает 1024 KB.';
        }

        // Если все проверки пройдены 
        return '';
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

        // запрещаем выбирать второй файл, если уже есть
        if (this.fileInput.files.length > 1) {
            this.form.classList.remove('success');
            this.form.classList.add('error', 'shrink', 'hide-elements');

            this.showMessage({ message: 'Уже выбран файл. Нельзя выбрать второй.' }, 'error');
            this.fileInput.value = '';
            this.uploadBtn.disabled = true;
            return;
        }

        const file = event.target.files[0];
        if (!file) {
            this.uploadBtn.disabled = true;
            return;
        }

        const error = this.validateFile(file);
        if (error) {
            this.form.classList.remove('success');
            this.form.classList.add('error', 'shrink', 'hide-elements');

            this.showMessage({ message: error }, 'error');
            this.fileInput.value = '';
            this.uploadBtn.disabled = true;
            return;
        }

        // Если имя ещё не заполнено, берём из файла
        if (!this.nameInput.value.trim()) {
            this.nameInput.value = file.name;
        }

        // Анимация
        this.loadingMessage.textContent = this.nameInput.value.trim();
        this.fileInputContainer.classList.add('shift-up');
        this.inputContainer.classList.add('invisible');

        this.validateForm();
        this.uploadBtn.disabled = true;

        this.fileInputContainer.addEventListener('animationend', () => {
            this.loadingContainer.classList.remove('hidden');
            this.startProgressAnimation();
        }, { once: true });
    }

    handleDrop(event) {
        event.preventDefault();

        if (this.dropInProgress) {
            return;
        }
        this.dropInProgress = true;

        this.clearMessage();
        this.fileInputContainer.classList.remove('dragging');

        const files = event.dataTransfer.files;

        // Если уже выбран файл
        if (this.fileInput.files.length > 0) {
            this.form.classList.remove('success');
            this.form.classList.add('error', 'shrink', 'hide-elements');

            this.showMessage({ message: 'Уже выбран один файл. Очистите форму или загрузите текущий файл.' }, 'error');
            this.dropInProgress = false;
            return;
        }

        // Если нет файлов
        if (!files || files.length === 0) {
            this.form.classList.remove('success');
            this.form.classList.add('error', 'shrink', 'hide-elements');

            this.showMessage({ message: 'Файл не обнаружен при перетаскивании.' }, 'error');
            this.dropInProgress = false;
            return;
        }

        // Если перетащили сразу несколько
        if (files.length > 1) {
            this.form.classList.remove('success');
            this.form.classList.add('error', 'shrink', 'hide-elements');

            this.showMessage({ message: 'Выберите только один файл для загрузки.' }, 'error');
            this.dropInProgress = false;
            return;
        }

        const file = files[0];
        const error = this.validateFile(file);
        if (error) {
            this.form.classList.remove('success');
            this.form.classList.add('error', 'shrink', 'hide-elements');

            this.showMessage({ message: error }, 'error');
            this.dropInProgress = false;
            return;
        }

        // Если имя не заполнено
        if (!this.nameInput.value.trim()) {
            this.nameInput.value = file.name;
        }

        this.inputContainer.classList.add('invisible');
        this.fileInputContainer.classList.add('shift-up');

        // Добавляем файл в this.fileInput
        const dt = new DataTransfer();
        dt.items.add(file);
        this.fileInput.files = dt.files;

        this.loadingMessage.textContent = this.nameInput.value.trim();
        this.validateForm();
        this.uploadBtn.disabled = true;

        this.fileInputContainer.addEventListener('animationend', () => {
            this.loadingContainer.classList.remove('hidden');
            this.startProgressAnimation();
            this.dropInProgress = false;
        }, { once: true });
    }

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
        this.uploadBtn.disabled = true;
        this.loadingContainer.classList.remove('hidden');

        const progressBar = this.shadowRoot.getElementById('progressBar');
        const progressText = this.shadowRoot.getElementById('progressText');

        progressBar.value = 0;
        progressText.textContent = '0%';

        const duration = 1000; // 1 секунда
        const interval = 100;  // шаг каждые 100 мс
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
        this.shadowRoot.host.classList.add('blocked');
        this.clearMessage();

        // Блокируем элементы на время запроса
        this.uploadBtn.disabled = true;
        this.nameInput.disabled = true;
        this.fileInput.disabled = true;

        const file = this.fileInput.files[0];
        const customName = this.nameInput.value.trim();

        // Формируем FormData
        const formData = new FormData();
        formData.append('name', customName || file.name);
        formData.append('file', file);

        try {
            const response = await axios.post(this.uploadUrl, formData);
            const result = response.data;

            this.form.classList.remove('error');
            this.form.classList.add('success', 'shrink', 'hide-elements');

            this.showMessage({
                name: result.nameField || customName || file.name,
                filename: result.filename || file.name,
                timestamp: result.timestamp,
                message: result.message
            }, 'success');

        } catch (error) {
            this.form.classList.remove('success');
            this.form.classList.add('error', 'shrink', 'hide-elements');

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

            this.showMessage({ message: errorMessage }, 'error');
        } finally {
            this.uploadBtn.disabled = false;
            this.nameInput.disabled = false;
            this.fileInput.disabled = false;
            this.shadowRoot.host.classList.remove('blocked');
        }
    }

    clearMessage() {
        this.messageBox.textContent = '';
        this.messageBox.classList.add('hidden');
    }


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

        if (type === 'error') {
            this.messageBox.innerHTML = `
                <h1>Ошибка загрузки</h1>
                <p><strong>message:</strong> ${data.message || 'Нет сообщения'}</p>
            `;
        } else {
            this.messageBox.innerHTML = `
                <h1>Файл успешно загружен</h1>
                <p>
                    name: ${data.name || 'Безымянный'}<br>
                    filename: ${data.filename || 'неизвестный'}<br>
                    timestamp: ${data.timestamp || '00:00:00'}<br>
                    message: ${data.message || 'Нет сообщения'}
                </p>
            `;
        }

        this.messageBox.className = 'visible ' + (type === 'success' ? 'msg-success' : 'msg-error');

        // Меняем фон формы на градиент
        if (type === 'success') {
            this.uploadForm.style.background =
                'linear-gradient(rgba(95, 92, 240, 1), rgba(143, 141, 244, 1))';
        } else {
            this.uploadForm.style.background =
                'linear-gradient(rgba(240, 92, 92, 1), rgba(143, 141, 244, 1))';
        }
    }

    // Сброс формы
    resetFormState() {
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
    }

    handleMainClose() {
        this.messageBox.classList.add('hidden');
        this.fileInputContainer.classList.remove('shift-up');
        this.inputContainer.classList.remove('invisible');
        this.loadingContainer.classList.add('hidden');

        // Возвращаем форму к первоначальному виду
        this.uploadForm.style.background = this.uploadFormInitialBackground;
        this.form.classList.remove('shrink');
        setTimeout(() => {
            this.form.classList.remove('hide-elements');
        }, 500);

        // Сбрасываем поля
        this.fileInput.value = '';
        this.nameInput.value = '';

        this.uploadBtn.disabled = true;
    }
}

customElements.define('file-uploader', FileUploader);