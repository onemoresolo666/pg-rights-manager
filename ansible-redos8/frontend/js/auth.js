// 1. ОТПРАВКА ФОРМЫ АВТОРИЗАЦИИ (ЛОГИН С ИБ-РОЛЯМИ)
export async function submitLoginForm(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const alertDiv = document.getElementById('loginAlert');
    
    try {
        const res = await fetch('/api/login/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (res.ok && data.access_token) {
            localStorage.setItem("pg_access_token", data.access_token);
            
            // Динамически определяем роль из ответа API
            let userRole = data.role;
            if (!userRole) {
                const lowerName = username.toLowerCase();
                if (lowerName === 'auditor') {
                    userRole = 'auditor';
                } else if (lowerName.includes('sec') || lowerName.includes('officer') || lowerName.includes('manager')) {
                    userRole = 'Security_Manager'; // Защита новой роли ИБ-офицера от сброса в admin
                } else {
                    userRole = 'admin';
                }
            }
            
            localStorage.setItem('panel_user_role', userRole);
            window.location.reload();
        } else {
            // ИБ-ВЫПРЯМИТЕЛЬ: Извлекаем реальный текст ответа бэкенда (сообщение о бане 403 или неверном пароле 401)
            // Метод .replace() хирургически вырезает любые случайные спецсимволы и смайлики, защищая верстку
            const serverMessage = data.detail || 'Неверное имя пользователя или пароль';
            const cleanMessage = serverMessage.replace(/[^\x00-\x7Fа-яА-ЯёЁ\s\.,!\?-]/g, '');
            
            alertDiv.innerHTML = `<div class="alert alert-danger small p-2 text-center">${cleanMessage}</div>`;
        }
    } catch (err) {
        alertDiv.innerHTML = `<div class="alert alert-danger small p-2 text-center">Ошибка сети: ${err.message}</div>`;
    }
}

export function logoutSession() {
    localStorage.removeItem('pg_access_token');
    window.location.reload();
}