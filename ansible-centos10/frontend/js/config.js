
// 1. ОБЁРТКА НАД FETCH: ПРОБРАСЫВАЕТ JWT-ТОКЕН ВО ВСЕ ЗАПРОСЫ
export async function secureFetch(url, options = {}) {
    const token = localStorage.getItem('pg_access_token');
    
    // Если токен есть в кэше, внедряем его в заголовки запроса
    if (token) {
        if (!options.headers) options.headers = {};
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, options);

    // Если сервер вернул 401 (Нет авторизации / Токен протух)
    if (response.status === 401) {
        // Проверяем наличие токена в памяти ДО момента очистки
        const hasToken = localStorage.getItem('pg_access_token');
        
        if (hasToken) {
            // КОНТУР А: Сессия протухла во время работы.
            // Атомарно зачищаем невалидные сессии и жестко перезагружаем рантайм.
            // Это заставит стартовый скрипт инициализировать чистый экран логина.
            localStorage.removeItem('pg_access_token');
            localStorage.removeItem('panel_user_role');
            window.location.reload();
        } else {
            // КОНТУР Б: Токена и так не было (первый холодный старт вкладки).
            // Мягко переключаем контейнеры видимости без вызова перезагрузок страницы.
            const loginContainer = document.getElementById('loginContainer');
            const appContainer = document.getElementById('appContainer');
            
            if (loginContainer && appContainer) {
                loginContainer.classList.remove('d-none');
                appContainer.classList.add('d-none');
            }
        }
    }

    return response;
}


// 2. АЛЕРТ ИНДИКАТОР УВЕДОМЛЕНИЙ
export function showAlert(message, type = 'success') {
    // Вырезаем любые HTML-теги, если они остались в старых вызовах автора
    const cleanMessage = message ? message.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    
    if (cleanMessage) {
        // Вызываем строгое системное диалоговое окно браузера поверх панели СУБД
        alert(cleanMessage);
    }
}
