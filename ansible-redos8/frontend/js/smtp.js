import { secureFetch, showAlert } from './config.js';

export async function submitSmtpConfigForm(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    
    const smtp_host = document.getElementById('smtpHost').value.trim();
    const smtp_port = parseInt(document.getElementById('smtpPort').value, 10);
    const smtp_user = document.getElementById('smtpUser').value.trim();
    const smtp_password = document.getElementById('smtpPassword').value;
    
    // [UI/UX АВТОМАТИКА]: Считываем селектор и переводим в булевый тип (true/false)
    const use_tls = document.getElementById('smtpUseTls').value === 'true';
    
    try {
        const response = await secureFetch('/api/smtp/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ smtp_host, smtp_port, smtp_user, smtp_password, use_tls })
        });
        const data = await response.json();
        
        if (response.ok) {
            showAlert(data.message || 'Конфигурация SMTP запечатана в .env и применена!', 'success');
        } else {
            showAlert(data.detail || 'Ошибка валидации параметров шлюза.', 'danger');
        }
    } catch (err) {
        showAlert('Сбой сетевого коннекта при сохранении SMTP: ' + err.message, 'danger');
    }
}

export async function submitSmtpTestForm(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    
    const recipient = document.getElementById('smtpTestRecipient').value.trim();
    const btnSubmit = document.getElementById('btnSmtpTestSubmit');
    
    // Анимация ожидания (UX-стандарт Enterprise уровня)
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = 'Отправка...';
    }
    
    try {
        const response = await secureFetch('/api/smtp/test-send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient })
        });
        const data = await response.json();
        
        if (response.ok) {
            showAlert(data.message || 'Тестовый алерт успешно доставлен адресату!', 'success');
        } else {
            showAlert(data.detail || 'Почтовый шлюз отклонил авторизацию.', 'danger');
        }
    } catch (err) {
        showAlert('Сбой рантайма при коннекте к SMTP-хосту: ' + err.message, 'danger');
    } finally {
        // Возвращаем кнопку в исходное боевое состояние
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Отправить тест';
        }
    }
}
