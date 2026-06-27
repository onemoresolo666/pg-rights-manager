import { secureFetch, showAlert } from './config.js';

export let globalServersCache = [];
export let currentServersPage = 1;
export const serversPerPage = 5;


// 1. ДИНАМИЧЕСКИЕ НАПОЛНЕНИЯ СЕЛЕКТОРОВ И АВТОКОМПЛИТЫ
export async function loadServersForSelect() {
    try {
        const response = await secureFetch('/api/servers/');
        if (!response.ok) return;
        const data = await response.json();
        
        const servers = data.servers || data;
        if (!Array.isArray(servers)) return;

        // 1. НАБОР ОПЦИЙ ДЛЯ ТЕКСТОВЫХ ДАТА-ЛИСТОВ (ВКЛАДКА 1 И ВКЛАДКА 2)
        let datalistOptionsHtml = '';
        servers.forEach(s => {
            const sId = s.server_id || s.id;
            if (sId) {
                datalistOptionsHtml += `<option value="${sId}"></option>`;
            }
        });

        // Аппаратный инжект в дата-листы первой вкладки
        const listIds = ['createUserServerDatalist', 'deleteUserServerDatalist', 'lockUserServerDatalist', 'globalTargetServerDatalist'];
        listIds.forEach(id => {
            let dl = document.getElementById(id);
            if (!dl) {
                dl = document.createElement('datalist');
                dl.id = id;
                document.body.appendChild(dl);
            }
            dl.innerHTML = datalistOptionsHtml;
        });

        // Навешиваем правильные атрибуты на инпуты первой вкладки для страховки
        const inputCreate = document.getElementById('createUserTargetServer');
        if (inputCreate) inputCreate.setAttribute('list', 'createUserServerDatalist');
        const inputDelete = document.getElementById('deleteUserTargetServer');
        if (inputDelete) inputDelete.setAttribute('list', 'deleteUserServerDatalist');
        const inputLock = document.getElementById('lockUserTargetServer');
        if (inputLock) inputLock.setAttribute('list', 'lockUserServerDatalist');

        // 2. ТОЧЕЧНЫЙ ПЕРЕХВАТ И АКТИВАЦИЯ ФИЛЬТРА НА ВКЛАДКЕ 2
        const selectElement = document.getElementById('globalTargetServer');
        if (selectElement) {
            // Привязываем наш новый поисковый дата-лист ко второй вкладке
            selectElement.setAttribute('list', 'globalTargetServerDatalist');
            
            // Если в вашей системе есть старый обработчик изменения сервера — триггерим его
            if (typeof onServerChanged === 'function') {
                // Используем универсальное событие 'input' для мгновенного подхвата клавиатуры дата-листа
                selectElement.removeEventListener('change', onServerChanged);
                selectElement.removeEventListener('input', onServerChanged);
                selectElement.addEventListener('input', onServerChanged);
            }
            console.log("[ИБ АВТОМАТИКА] Живой фильтр Вкладки 2 успешно взведён!");
        }

        console.log("[ИБ АВТОМАТИКА] Все контуры серверов синхронизированы!");
    } catch (err) {
        console.error("Сбой универсального инжектора серверов:", err);
    }
}


// 2. ОРИГИНАЛЬНЫЕ КАСКАДНЫЕ НАПОЛНЕНИЯ СЕЛЕКТОРОВ И АВТОКОМПЛИТЫ

export function changeServersPage(pageNumber) {
    // Обновляем номер глобальной рантайм-страницы кластеров
    currentServersPage = pageNumber; 
    
    // ИБ-ПРОВЕРКА КОНТЕКСТА: Проверяем, введён ли текст в инпут быстрого поиска серверов
    const searchInput = document.getElementById('searchServerInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    if (query && typeof globalServersCache !== 'undefined' && globalServersCache.length > 0) {
        // Если администратор находится в режиме быстрого поиска — листаем строго отфильтрованный срез серверов!
        const filtered = globalServersCache.filter(s => 
            (s.server_id || '').toLowerCase().includes(query) || 
            (s.host || '').toLowerCase().includes(query)
        );
        renderServersTable(filtered);
    } else if (typeof globalServersCache !== 'undefined' && globalServersCache.length > 0) {
        // Если поиска нет — плавно перерисовываем классический полный кэш-массив автора
        renderServersTable(globalServersCache);
    } else {
        // Страховочный асинхронный перезапрос к API, если RAM-память была очищена
        if (typeof loadServersRegistry === 'function') loadServersRegistry();
    }
}
export function filterServersTable() {
    currentServersPage = 1;
    const query = document.getElementById('searchServerInput').value.toLowerCase().trim();
    const filtered = globalServersCache.filter(s => (s.server_id || '').toLowerCase().includes(query) || (s.host || '').toLowerCase().includes(query));
    renderServersTable(filtered);
}
export async function testRowConnection(server_id, host, port, db_user, dbname) {
    showAlert(`Проверяем подключение к серверу "${server_id}"...`, 'info');
    try {
        const res = await secureFetch('/api/test-server-connection/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ server_id, host, port: parseInt(port)||5432, db_user, dbname, password: "via_saved_credentials" }) });
        if (res.ok) showAlert(`Соединение с сервером "${server_id}" (${host}) успешно установлено!`, 'success');
        else { const d = await res.json(); showAlert(`Ошибка подключения к "${server_id}": ${d.detail || 'Сбой проверки'}`, 'danger'); }
    } catch (err) { showAlert(`Ошибка сети при проверке инстанса "${server_id}": ${err.message}`, 'danger'); }
}
export async function testConnectionBeforeRegister() {
    const host = document.getElementById('regHost')?.value?.trim();
    const port = document.getElementById('regPort')?.value?.trim();
    const user = document.getElementById('regUser')?.value?.trim();
    const dbname = document.getElementById('regDbname')?.value?.trim();
    const password = document.getElementById('regPassword')?.value;

    // Нативный ИБ-перехват параметров
    if (!host || !user || !dbname || !password) {
        alert('Заполните технические параметры для теста!');
        return;
    }

    try {
        // Отправляем побитово точную Pydantic-модель, которую требует FastAPI бэкенд
        const res = await secureFetch('/api/test-server-connection/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                server_id: "test", // Жесткая заглушка ID для валидатора бэкенда
                host: host,
                port: parseInt(port, 10) || 5432, // Защита от NaN
                db_user: user, // Строго db_user
                dbname: dbname, // Строго dbname в одно слово
                password: password
            })
        });

        if (res.ok) {
            alert('Подключение успешно установлено!');
        } else {
            const d = await res.json();
            alert(d.detail || 'Сбой проверки соединения: проверьте корректность пароля СУБД');
        }
    } catch (err) {
        alert('Сбой проксирования проверочного пакета: ' + err.message);
    }
}
export async function submitRegisterServerForm(event) {
    if (event) event.preventDefault();
 
    // Нативно перехватываем параметры по обоим вариантам написания ID в разметке
    const server_id = (document.getElementById('regId') || document.getElementById('id') || document.getElementById('serverId'))?.value?.trim();
    const host = (document.getElementById('regHost') || document.getElementById('host'))?.value?.trim();
    const port = (document.getElementById('regPort') || document.getElementById('port'))?.value;
    const db_user = (document.getElementById('regUser') || document.getElementById('user'))?.value?.trim();
    const dbname = (document.getElementById('regDbname') || document.getElementById('dbname') || document.getElementById('regDbName'))?.value?.trim();
    const password = (document.getElementById('regPassword') || document.getElementById('password'))?.value;
 
    if (!server_id || !host || !db_user || !dbname || !password) {
        alert('Заполните все поля конфигурации для регистрации сервера PostgreSQL!');
        return;
    }
 
    try {
        // Отправляем выверенный POST-запрос с точечной семантикой ключей FastAPI бэкенда
        const response = await secureFetch('/api/register-server/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                server_id,
                host,
                port: parseInt(port, 10) || 5432,
                db_user,
                dbname,
                password
            })
        });
        const data = await response.json();
 
        if (response.ok) {
            alert(data.message || `Успешно! Инстанс СУБД ${server_id} официально внесён в реестр кластеров!`);
 
            // Мягко очищаем поля формы после успешного добавления
            const form = document.getElementById('registerServerForm');
            if (form) form.reset();
 
            // Асинхронно обновляем таблицу реестра ниже и селекторы шапки веером
            if (typeof loadServersRegistry === 'function') loadServersRegistry();
            if (typeof loadServersForSelect === 'function') loadServersForSelect();
        } else {
            alert(data.detail || 'Ошибка добавления инстанса в СУБД: проверьте доступы бэкенда');
        }
    } catch (err) {
        alert('Ошибка сети при регистрации кластера: ' + err.message);
    }
}
export async function deleteServer(id) {
    if (!confirm(`Вы действительно хотите безвозвратно удалить сервер "${id}" из реестра конфигураций?`)) return;
    try {
        const res = await secureFetch(`/api/servers/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert(`Инстанс СУБД "${id}" успешно удалён из реестра конфигураций!`);
            loadServersRegistry();
            if (typeof loadServersForSelect === 'function') loadServersForSelect();
        } else {
            alert('Не удалось убрать хост из реестра СУБД. Ошибка бэкенда.');
        }
    } catch {
        alert('Сбой сети при удалении профиля сервера');
    }
}
export async function onDeleteServerChanged() {
    const srvId = document.getElementById('deleteUserTargetServer').value;
    const delInput = document.getElementById('deleteUserSelect');
    const delDatalist = document.getElementById('deleteUserDatalist');
    if (!srvId) { delDatalist.innerHTML = ''; delInput.value = ''; return; }
    delInput.placeholder = 'Загрузка ролей кластера...';
    try {
        const res = await secureFetch(`/api/get-target-roles/${srvId}?show_system=false`);
        const data = await res.json();
        delDatalist.innerHTML = ''; delInput.placeholder = 'Начните вводить имя...'; delInput.value = '';
        if(data.roles) data.roles.forEach(r => { delDatalist.innerHTML += `<option value="${r}"></option>`; });
    } catch { delInput.placeholder = 'Ошибка загрузки учетных записей'; }
}

export async function onLockServerChanged() {
    const srvId = document.getElementById('lockUserTargetServer').value;
    const lockInput = document.getElementById('lockUserSelect');
    const lockDatalist = document.getElementById('lockUserDatalist');
    if (!srvId) { lockDatalist.innerHTML = ''; lockInput.value = ''; return; }
    lockInput.placeholder = 'Загрузка ролей кластера...';
    try {
        const res = await secureFetch(`/api/get-target-roles/${srvId}?show_system=false`);
        const data = await res.json();
        lockDatalist.innerHTML = ''; lockInput.placeholder = 'Начните вводить имя...'; lockInput.value = '';
        if(data.roles) data.roles.forEach(r => { lockDatalist.innerHTML += `<option value="${r}"></option>`; });
    } catch { lockInput.placeholder = 'Ошибка загрузки учетных записей'; }
}
export async function inlineTestServerConnection(serverId) {
    if (!serverId) return;

    // Считываем параметры строки прямо из дата-атрибутов tr разметки
    const row = document.querySelector(`tr[data-server-id="${serverId}"]`) || 
                Array.from(document.querySelectorAll('#serversTableBody tr, #serversTable tbody tr')).find(r => r.innerText.includes(serverId));
    
    const host = row?.getAttribute('data-host') || '127.0.0.1';
    const port = parseInt(row?.getAttribute('data-port') || '5432', 10);
    const db_user = row?.getAttribute('data-user') || 'postgres';
    const dbname = row?.getAttribute('data-dbname') || 'postgres';

    // Безопасно запрашиваем пароль в рантайме, исключая пустой ввод
    const password = prompt(`Введите актуальный пароль пользователя "${db_user}" для проверки связи с инстансом "${serverId}" (${host}):`);
    if (password === null) return; // Если нажали "Отмена" - мягко выходим
    if (!password.trim()) {
        alert("Проверка отменена: пароль СУБД не может быть пустым!");
        return;
    }

    try {
        // Отправляем выверенный POST-пакет на бэкенд FastAPI
        const response = await secureFetch('/api/test-server-connection/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                server_id: serverId,
                host: host,
                port: port,
                db_user: db_user, 
                dbname: dbname,
                password: password.trim()
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            alert(`Успешно! Связь с СУБД PostgreSQL "${serverId}" установлена. Версия: ${data.version || 'OK'}`);
        } else {
            alert(`Ошибка проверки "${serverId}": ${data.detail || 'Сбой авторизации кластера'}`);
        }
    } catch (err) {
        alert(`Критическая ошибка сети при пинге "${serverId}": ` + err.message);
    }
}
function renderServersPagination(totalItems, currentPage, pageSize) {
    const totalPages = Math.ceil(totalItems / pageSize);
    const container = document.getElementById('serversPagination');
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return; // Если страниц меньше одной, переключатель не нужен
 
    let html = '';
    
    // Кнопка Назад
    if (currentPage > 1) {
        html += `<button class="btn" onclick="changeServersPage(${currentPage - 1}); return false;">« Назад</button>`;
    } else {
        html += `<button class="btn" disabled style="opacity: 0.5; cursor: not-allowed !important;">« Назад</button>`;
    }
 
    // Генерация цифровых кнопок на основе кэша
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<button class="btn active" style="background-color: #f1f5f9 !important; border-color: #cbd5e1 !important; color: #0f172a !important; font-weight: 700 !important;" disabled>${i}</button>`;
        } else {
            html += `<button class="btn" onclick="changeServersPage(${i}); return false;">${i}</button>`;
        }
    }
 
    // Кнопка Вперед
    if (currentPage < totalPages) {
        html += `<button class="btn" onclick="changeServersPage(${currentPage + 1}); return false;">Вперед »</button>`;
    } else {
        html += `<button class="btn" disabled style="opacity: 0.5; cursor: not-allowed !important;">Вперед »</button>`;
    }
 
    container.innerHTML = html;
}
export async function loadServersRegistry() {
    const tbody = document.getElementById('serversTable').querySelector('tbody');
    try {
        const res = await secureFetch(`/api/servers/?_=${Date.now()}`);
        const data = await res.json();
        tbody.innerHTML = '';
        if (data.servers && data.servers.length > 0) {
            globalServersCache = data.servers;
            renderServersTable(globalServersCache);
        } else {
            globalServersCache = [];
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Реестр серверов пуст</td></tr>';
        }
    } catch { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Ошибка загрузки реестра серверов</td></tr>'; }
}
function renderServersTable(serversList) {
    const tbody = document.getElementById('serversTableBody') || document.getElementById('serversTable')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
 
    if (!serversList || serversList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 25px !important;">Реестр подключенных инстансов PostgreSQL пуст</td></tr>';
        return;
    }
 
    // Вырезаем строго по 5 серверов под текущую активную страницу
    const size = typeof serversPerPage !== 'undefined' ? serversPerPage : 5;
    const page = typeof currentServersPage !== 'undefined' ? currentServersPage : 1;
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    const slicedServers = serversList.slice(startIndex, endIndex);
 
    // Цикл теперь перебирает строго отсечённую порцию серверов для текущей страницы
    slicedServers.forEach(s => {
        const srvId = s.server_id || s.id;
        const dbUser = s.db_user || s.user || s.username || 'postgres';
 
        tbody.innerHTML += `
        <tr data-server-id="${srvId}" data-host="${s.host}" data-port="${s.port}" data-user="${dbUser}" data-dbname="${s.dbname}">
            <td class="fw-bold" style="padding: 12px 14px !important; color: #1e293b !important; vertical-align: middle !important;">${srvId}</td>
            <td style="padding: 12px 14px !important; color: #475569 !important; font-family: monospace !important; font-size: 0.9rem !important; vertical-align: middle !important;">${s.host}</td>
            <td style="padding: 12px 14px !important; vertical-align: middle !important;">
                <span class="badge bg-secondary text-white" style="padding: 4px 7px !important; font-family: monospace !important; font-size: 0.8rem !important; border-radius: 4px !important;">${s.port}</span>
            </td>
            <td style="padding: 12px 14px !important; vertical-align: middle !important; color: #1e293b !important; font-weight: 500;">${dbUser}</td>
            <td class="text-muted" style="padding: 12px 14px !important; vertical-align: middle !important;">${s.dbname}</td>
            <td style="white-space: nowrap !important; vertical-align: middle !important; padding: 12px 14px !important; width: 110px !important;">
                <div style="display: inline-flex !important; gap: 8px !important; justify-content: flex-start !important; align-items: center !important;">
                    <button type="button" class="btn-table-action btn-action-pass" title="Проверить коннект" onclick="inlineTestServerConnection('${srvId}')">
                        <svg xmlns="http://w3.org" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                    </button>
                    <button type="button" class="btn-table-action btn-action-delete" title="Удалить" onclick="deleteServer('${srvId}')">
                        <svg xmlns="http://w3.org" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </td>
        </tr>`;
    });
 
    // На запуск отрисовки цифровых кнопок пагинации внизу таблицы 3-й вкладки
    if (typeof renderServersPagination === 'function') {
        renderServersPagination(serversList.length, page, size);
    }
}

export async function inlineDeleteServer(serverId) {
    if (!serverId) return;

    // Предотвращаем сброс сессии: сохраняем токен в буфере рантайма
    const savedToken = localStorage.getItem('pg_access_token');

    if (!confirm(`КРИТИЧЕСКОЕ ДЕЙСТВИЕ!\n\nВы действительно хотите полностью УДАЛИТЬ инстанс "${serverId}" из реестра панели?\nЭто действие зафиксируется в журнале ИБ-аудита.`)) return;

    showAlert(`Запуск исключения инстанса "${serverId}"...`, 'secondary');

    try {
        // Отправляем строго оригинальное текстовое имя из таблицы
        const response = await secureFetch(`/api/servers/${encodeURIComponent(serverId)}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        // В обязательном порядке возвращаем токен в память, исключая сброс на экран логина
        if (savedToken) localStorage.setItem('pg_access_token', savedToken);

        if (response.ok) {
            showAlert(data.message || `Инстанс "${serverId}" успешно исключён из реестра панели`, 'success');

            // Синхронизируем каскадное обновление выпадающих списков на остальных вкладках
            if (typeof loadServersForSelect === 'function') loadServersForSelect();

            // Находим строку в таблице по её текстовому значению и мягко стираем из DOM-дерева браузера без перезапуска окна
            const tableRows = document.querySelectorAll('#serversTableBody tr, #serversTable tbody tr');
            let removedFromDom = false;

            tableRows.forEach(row => {
                if (row.innerText.includes(serverId)) {
                    row.remove();
                    removedFromDom = true;
                }
            });

            // Страховочный вариант: если не удалось удалить строку из DOM, делаем мягкое обновление окна
            if (!removedFromDom) {
                setTimeout(() => { window.location.reload(); }, 1000);
            }
        } else {
            showAlert(`Ошибка удаления "${serverId}": ${data.detail || 'Сервер не найден'}`, 'danger');
        }
    } catch (err) {
        if (savedToken) localStorage.setItem('pg_access_token', savedToken);
        showAlert(`Критическая ошибка сети при удалении "${serverId}": ` + err.message, 'danger');
    }
}

