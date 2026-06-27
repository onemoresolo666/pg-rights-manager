// =========================================================================
// ИБ-МОНОЛИТ
// =========================================================================
import { secureFetch, showAlert } from './config.js';

// ГЛОБАЛЬНЫЙ КЭШ И ЛИМИТЫ ПАГИНАЦИИ DBA
export let globalPanelUsersCache = []; 
export let currentPanelUsersPage = 1; 
export const panelUsersPerPage = 5; 

// =========================================================================
// 1. УПРАВЛЕНИЕ АДМИНИСТРАТОРАМИ ПАНЕЛИ
// =========================================================================
export async function submitRegisterPanelUserForm(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    // [КРИТИЧЕСКИЙ СИНХРОН ОЗУ]: Сначала считываем данные, чтобы username родился в памяти!
    const username = document.getElementById('panelUserLogin')?.value?.trim() || '';
    let password = document.getElementById('panelUserPassword')?.value || '';
    const role = document.getElementById('panelUserRole')?.value || 'admin';
    const submitBtn = document.getElementById('btnSubmitRegisterAdmin') || document.querySelector('#panelAdminTab button[type="submit"]');

    if (!username || username === "") {
        showAlert('⚠️ Ошибка ИБ-валидации: Введите имя учётной записи администратора!', 'danger');
        return;
    }

    let finalPassword = password;
    
    const usernameClean = String(username).trim().toLowerCase();
    let isUpdateMode = false;

    // Находим текущий режим работы главной кнопки на экране (создание или изменение)
    const isEditButton = submitBtn && (submitBtn.innerText === 'Сохранить изменения' || submitBtn.textContent.includes('изменения'));

    // =========================================================================
    // ПРОВЕРКА СУЩЕСТВОВАНИЯ ЮЗЕРА
    // =========================================================================
    try {
        const checkRes = await secureFetch('/api/admin/panel-users-list');
        if (checkRes.ok) {
            const checkData = await checkRes.json();
            const currentUsersList = checkData.users || (Array.isArray(checkData) ? checkData : []);
            
            // Жестко проверяем наличие логина в реальной базе данных прямо сейчас
            isUpdateMode = currentUsersList.some(u => String(u.username || "").trim().toLowerCase() === usernameClean);
        }
    } catch (cacheErr) {
        console.warn("[ИБ НАДЗИРАТЕЛЬ] Фоновый API-детектор недоступен, фолбек на статус кнопки:", cacheErr);
        isUpdateMode = isEditButton;
    }

    // Если кнопка переключена ИЛИ если API подтвердил существование юзера — это 100% UPDATE лимитов
    const finalUpdateCheck = isEditButton || isUpdateMode;

    if (finalUpdateCheck) {
        // РЕЖИМ ИЗМЕНЕНИЯ: Если поле пароля пустое — оставляем пустую строку,
        // чтобы заводской бэкенд на Python не трогал хэш пароля в базе данных!
        if (!finalPassword || finalPassword.length < 8) {
            console.log(`[ИБ НАДЗИРАТЕЛЬ] Пользователь "${username}" найден. Изменение лимитов без пароля.`);
            finalPassword = ""; 
        }
    } else {
        // РЕЖИМ СОЗДАНИЯ: Для абсолютно нового пользователя пароль строго обязателен!
        if (!finalPassword || finalPassword.length === 0) {
            showAlert('⚠️ Ошибка ИБ-валидации: Введите мастер-пароль для создания новой учетной записи!', 'danger');
            return;
        }
    }

    // -------------------------------------------------------------------------
    // Разделение сбора и валидации пулов строго по 3 ролям
    // -------------------------------------------------------------------------
    let serversArray = [];
    let rolesArray = [];

    const cleanRoleCheck = String(role).trim().toLowerCase();

    if (cleanRoleCheck === "admin" || cleanRoleCheck === "administrator") {
        // 1. АДМИНИСТРАТОР: Лимиты не требуются, пакуем безлимитный маркер "ALL"
        serversArray = ["ALL"];
        rolesArray = ["ALL"];
    } else if (cleanRoleCheck === "auditor" || cleanRoleCheck === "аудитор") {
        // 2. АУДИТОР ИБ: Лимиты не требуются, пакуем маркер безопасного ReadOnly
        serversArray = ["NONE_READONLY"];
        rolesArray = ["NONE_READONLY"];
    } else {
        // 3. (ИБ-офицер / Security_Manager): Извлекаем текстовые строки из инпутов на экране
        const elSrv1 = document.getElementById('panelUserAllowedServers');
        const elSrv2 = document.getElementById('secAllowedServers');
        const elSrv3 = document.getElementById('globalAllowedServers');
        
        const elRole1 = document.getElementById('panelUserAllowedRoles') || document.getElementById('panelUserAllowedTargetRoles');
        const elRole2 = document.getElementById('secAllowedRoles') || document.getElementById('secAllowedTargetRoles');
        const elRole3 = document.getElementById('globalAllowedRoles') || document.getElementById('globalAllowedTargetRoles');

        // Послушно и последовательно вытягиваем текст, полностью исключая SyntaxError скобок!
        const serversRaw = ((elSrv1 ? elSrv1.value : '') || (elSrv2 ? elSrv2.value : '') || (elSrv3 ? elSrv3.value : '') || '').trim();
        const rolesRaw = ((elRole1 ? elRole1.value : '') || (elRole2 ? elRole2.value : '') || (elRole3 ? elRole3.value : '') || '').trim();

        // Чистый валидатор синтаксиса полей ввода
        if (!serversRaw || !rolesRaw || serversRaw === "" || rolesRaw === "") {
            showAlert('⚠️ Ошибка ИБ-валидации: Для роли ИБ-офицера заполнение пулов серверов и ролей обязательно!', 'danger');
            return;
        }

        // Превращаем строку через запятую в чистый массив строк
        serversArray = serversRaw.split(',').map(s => s.trim()).filter(s => s && s !== "");
        rolesArray = rolesRaw.split(',').map(r => r.trim()).filter(r => r && r !== "");

        if (serversArray.length === 0 || rolesArray.length === 0) {
            showAlert('⚠️ Ошибка ИБ-валидации: Введите корректные ID серверов и ролей через запятую!', 'danger');
            return;
        }
    }

    // Собираем Payload в строгом соответствии со схемой Pydantic-модели бэкенда
    const payload = {
        username: username,
        password: finalPassword,
        role: role,
        allowed_servers: serversArray, 
        allowed_target_roles: rolesArray 
    };

    // Направляем пакет в зависимости от режима изменения/создания
    const targetApiRoute = finalUpdateCheck ? '/api/admin/update-user-limits' : '/api/admin/configure-panel-manager';

    try {
        console.log(`[ИБ НАДЗИРАТЕЛЬ] Маршрут: ${targetApiRoute} | Payload:`, payload);
        
        const response = await secureFetch(targetApiRoute, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();

        if (response.ok) {
            showAlert(data.message || `Администратор "${username}" успешно обработан!`, 'success');

            // Находим форму и сбрасываем её в исходное состояние
            const form = document.getElementById('registerPanelUserForm');
            if (form) form.reset();

            // АВТОМАТИЧЕСКИЙ СHОС БЛОКИРОВОК ПОСЛЕ УСПЕШНОГО СОХРАНЕНИЯ
            const loginInput = document.getElementById('panelUserLogin');
            if (loginInput) {
                loginInput.removeAttribute('disabled'); 
            }

            if (submitBtn) {
                submitBtn.innerText = 'Создать аккаунт';
                submitBtn.textContent = 'Создать аккаунт';
                submitBtn.style.setProperty('background-color', '#2563eb', 'important'); 
            }

            // Выравниваем required-статусы обязательности полей
            if (typeof window.toggleAdminFieldsValidation === 'function') {
                window.toggleAdminFieldsValidation();
            }

            // Мгновенно перезагружаем таблицу администраторов внизу экрана, фиксируя RAM-кэш в ОЗУ
            if (typeof loadPanelUsers === 'function') loadPanelUsers();
        } else {
            showAlert(data.detail || 'Ошибка выполнения операции на бэкенде.', 'danger');
        }
    } catch (err) {
        showAlert('Ошибка сети при регистрации администратора: ' + err.message, 'danger');
    }
}



// =========================================================================
// АВТОМАТИЧЕСКОЕ НАПОЛНЕНИЕ ФОРМЫ ЛИМИТОВ ПРИ КЛИКЕ
// =========================================================================
export function editPanelUser(username) {
    if (!username || !window.globalPanelUsersCache) return;
    
    const u = window.globalPanelUsersCache.find(user => 
        String(user.username || "").trim().toLowerCase() === String(username).trim().toLowerCase()
    );
    
    if (!u) return;

    const loginInput = document.getElementById('panelUserLogin');
    const roleSelect = document.getElementById('panelUserRole');
    const passwordInput = document.getElementById('panelUserPassword');
    const serversInput = document.getElementById('panelUserAllowedServers') || document.getElementById('secAllowedServers');
    const rolesInput = document.getElementById('panelUserAllowedRoles') || document.getElementById('secAllowedRoles');
    const submitBtn = document.getElementById('btnSubmitRegisterAdmin') || document.querySelector('#panelAdminTab button[type="submit"]');

    if (loginInput) {
        loginInput.value = u.username;
        loginInput.setAttribute('disabled', 'true'); 
    }
    if (roleSelect) roleSelect.value = u.role || 'Security_Manager';
    if (passwordInput) passwordInput.value = '';
    
    const srvData = u.allowed_servers || u.servers || u.server_id || '';
    const rlsData = u.allowed_target_roles || u.allowed_target_role || u.roles || u.allowed_roles || '';
    
    if (serversInput) serversInput.value = Array.isArray(srvData) ? srvData.join(',') : String(srvData).trim();
    if (rolesInput) rolesInput.value = Array.isArray(rlsData) ? rlsData.join(',') : String(rlsData).trim();

    if (submitBtn) {
        submitBtn.innerText = 'Сохранить изменения';
        submitBtn.textContent = 'Сохранить изменения';
        submitBtn.style.setProperty('background-color', '#d97706', 'important'); 
    }

    if (typeof window.toggleAdminFieldsValidation === 'function') window.toggleAdminFieldsValidation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}



// =========================================================================
// 2. ИЗОЛИРОВАННАЯ ЗАГРУЗКА ДАННЫХ ИЗ API БЭКЕНДА В RAM ПАМЯТЬ
// =========================================================================
export async function loadPanelUsers() {
    const tbody = document.getElementById('panelUsersTableBody') || 
                  document.getElementById('panelUsersTable')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = ''; // Полная зачистка перед рендером!

    try {
        console.log("[ИБ НАДЗИРАТЕЛЬ] Чтение реестра пользователей СУБД бэкенда...");
        const res = await secureFetch('/api/admin/panel-users-list');
        const data = await res.json();
        const usersArray = data.users || (Array.isArray(data) ? data : []);

        if (usersArray.length > 0) {
            // Схлопываем декартово умножение строк LEFT JOIN
            const grouped = {};
            usersArray.forEach(current => {
                const dbId = current.id;
                if (!dbId) return;

                if (!grouped[dbId]) {
                    grouped[dbId] = {
                        id: dbId,
                        username: current.username || 'unknown',
                        role: current.role || 'Security_Manager',
                        is_active: current.is_active,
                        serversSet: new Set(),
                        rolesSet: new Set()
                    };
                }

                // Распиливаем агрегированные бэкендом строки через запятую
                const srv = current.allowed_servers || current.servers || current.allowed_server_id || current.server_id || '';
                if (Array.isArray(srv)) {
                    srv.forEach(s => { if (s && s !== "[object Object]") grouped[dbId].serversSet.add(String(s).trim().toLowerCase()); });
                } else if (srv && srv !== "" && srv !== "[object Object]") {
                    String(srv).split(',').forEach(s => { if (s && s.trim()) grouped[dbId].serversSet.add(s.trim().toLowerCase()); });
                }

                const rls = current.allowed_target_roles || current.roles || current.allowed_target_role || '';
                if (Array.isArray(rls)) {
                    rls.forEach(r => { if (r && r !== "[object Object]") grouped[dbId].rolesSet.add(String(r).trim().toLowerCase()); });
                } else if (rls && rls !== "" && rls !== "[object Object]") {
                    String(rls).split(',').forEach(r => { if (r && r.trim()) grouped[dbId].rolesSet.add(r.trim().toLowerCase()); });
                }
            });

            // Дублируем пулы во ВСЕ возможные свойства объектов,
            // чтобы наглухо удовлетворить любые проверки и вёрстку renderPanelUsersTable
            const cleanUsers = Object.values(grouped).map(u => {
                const srvArr = Array.from(u.serversSet).filter(Boolean);
                const rlsArr = Array.from(u.rolesSet).filter(Boolean);

                u.servers = srvArr;
                u.allowed_servers = srvArr.join(',');
                u.roles = rlsArr;
                u.allowed_target_roles = rlsArr.join(',');

                return u;
            });

            // =========================================================================
            // [ИБ НАДЗИРАТЕЛЬ]: ФИЛЬТРАЦИЯ МАССИВА ОЗУ ПЕРЕД ОТРИСОВКОЙ
            // =========================================================================
            // Перехватываем вбитый текст из поискового инпута
            const searchInput = document.getElementById("tableSearchInput");
            const filterText = searchInput ? searchInput.value.toLowerCase().trim() : "";

            const filteredUsers = cleanUsers.filter(user => {
                if (filterText === "") return true; // Если поиск пустой — пропускаем весь реестр СУБД

                const login = String(user.username || "").toLowerCase();
                const role = String(user.role || "").toLowerCase();
                const assignedServers = String(user.allowed_servers || "").toLowerCase();

                // Проверяем сквозное совпадение по логину, роли или привязанным серверам кластера
                return login.includes(filterText) || role.includes(filterText) || assignedServers.includes(filterText);
            });

            // Запечатываем отфильтрованный пул в глобальный кэш памяти и отдаем на рендеринг таблицы
            globalPanelUsersCache = filteredUsers;
            renderPanelUsersTable(globalPanelUsersCache);

        } else {
            globalPanelUsersCache = [];
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 24px !important;">Список администраторов панели пуст</td></tr>';
        }
    } catch (err) {
        console.error("🚨 Critical сбой загрузки списка СУБД:", err);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger" style="padding: 24px !important;">Ошибка загрузки списка администраторов</td></tr>';
    }
}

// =========================================================================
// [ИБ НАДЗИРАТЕЛЬ]: ТРИГГЕР ПОИСКА ПРОСТО ПЕРЕЗАПУСКАЕТ ТАБЛИЦУ НА СТРАНИЦЕ
// =========================================================================
function filterPanelUsersTable() {
    // Фильтр больше не воюет со стилями стирания DOM, он просто заставляет loadPanelUsers перечитать инпут!
    if (typeof loadPanelUsers === 'function') {
        loadPanelUsers(); 
    }
}

// Принудительно пробрасываем мост на шину window для инлайнового HTML атрибута oninput в index.html
window.filterPanelUsersTable = filterPanelUsersTable;



// =========================================================================
// 2.1 ИЗОЛИРОВАННАЯ ОТРИСОВКА РЕЕСТРА АДМИНИСТРАТОРОВ
// =========================================================================
function renderPanelUsersTable(usersList) {
    const tbody = document.getElementById('panelUsersTable')?.querySelector('tbody') || 
                  document.getElementById('panelUsersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
 
    const startIndex = (currentPanelUsersPage - 1) * panelUsersPerPage;
    const endIndex = startIndex + panelUsersPerPage;
    const slicedUsers = usersList.slice(startIndex, endIndex);
    
    slicedUsers.forEach(r => {
        const is_active = r.is_active;
        const badgeClass = is_active ? "bg-success" : "bg-danger";
        const badgeText = is_active ? "Active" : "Blocked";
        const lockTitle = is_active ? "Заблокировать сессию" : "Разблокировать сессию";
        const disableBtnAttr = r.username === 'admin' ? "disabled title='Системный администратор не подлежит блокировке'" : `title='${lockTitle}'`;
 
        // КРАСИВЫЕ ЗНАЧКИ ЗАМОЧКОВ
        const lockIconHtml = is_active 
            ? `<svg xmlns="http://w3.org" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`
            : `<svg xmlns="http://w3.org" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;
 
        // КРАСИВЫЕ КНОПКИ УДАЛЕНИЯ С SVG ПОЛИЛАЙНАМИ
        const deleteButtonHtml = r.username === 'admin'
            ? `<button class="btn-table-action btn-action-delete" disabled title="Системный root-аккаунт невозможно удалить"><svg xmlns="http://w3.org" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`
            : `<button class="btn-table-action btn-action-delete" title="Удалить администратора" onclick="window.inlineDeletePanelUser(${r.id}, '${r.username}')"><svg xmlns="http://w3.org" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>`;
 
        const currentRole = r.role || 'admin';
 
        // МАТОВЫЕ БЭЙДЖИ РОЛЕЙ ПАНЕЛИ
        let roleBadge = `<span class="badge text-white" style="background-color: #64748b !important; font-weight: 700 !important; padding: 4px 8px !important; border-radius: 4px !important;">Admin</span>`;
        let limitsContainerHtml = '';
        const srvPool = r.servers && r.servers.length > 0 ? r.servers.join(', ') : 'Без ограничений';
        const rolePool = r.roles && r.roles.length > 0 ? r.roles.join(', ') : 'Без лимитов';

        // UI/UX ПЕРЕХВАТ: Стилизуем блоки лимитов по кастам пользователей панели
        if (currentRole === 'Security_Manager') {
            roleBadge = `<span class="badge text-white" style="background-color: #3b82f6 !important; font-weight: 700 !important; padding: 4px 8px !important; border-radius: 4px !important;">Security_Manager</span>`;
            limitsContainerHtml = `
                <div style="font-size: 0.78rem !important; margin-top: 4px !important; line-height: 1.2 !important;" class="text-muted">
                    <strong style="color: #475569 !important;">Серверы:</strong> ${srvPool}<br>
                    <strong style="color: #64748b !important;">Роли:</strong> ${rolePool}
                </div>
            `;
        } else if (currentRole === 'auditor') {
            roleBadge = `<span class="badge text-white" style="background-color: #10b981 !important; font-weight: 700 !important; padding: 4px 8px !important; border-radius: 4px !important;">auditor</span>`;
            limitsContainerHtml = `
                <div style="font-size: 0.78rem !important; margin-top: 4px !important; line-height: 1.2 !important;" class="text-muted">
                    <strong style="color: #475569;">Серверы:</strong> ${srvPool}<br>
                    <strong style="color: #64748b;">Роли:</strong> ${rolePool}
                </div>
            `;
        } else {
            limitsContainerHtml = `
                <div style="font-size: 0.78rem !important; margin-top: 4px !important; line-height: 1.2 !important;" class="text-muted">
                    <strong style="color: #475569;">Серверы:</strong> ${srvPool}<br>
                    <strong style="color: #64748b;">Роли:</strong> ${rolePool}
                </div>
            `;
        }

        // ЭКРАНИРОВАНИЕ И ИНЖЕКТ СТРОК С УЛЬТИМАТИВНЫМ ФИКСОМ АРГУМЕНТОВ ЗАМОЧКА
        const safeUsername = String(r.username).replace(/'/g, "\\'");
        tbody.innerHTML += `
            <tr>
                <td style="padding: 12px 14px !important; vertical-align: middle !important;">${r.id}</td>
                <td class="fw-bold" style="padding: 12px 14px !important; vertical-align: middle !important; color: #1e293b !important;">${r.username}</td>
                <td style="padding: 12px 14px !important; vertical-align: middle !important; min-width: 200px !important;">
                    <div>${roleBadge}</div>
                    ${limitsContainerHtml}
                </td>
                <td style="padding: 12px 14px !important; vertical-align: middle !important;">
                    <span class="badge ${badgeClass} text-white" style="padding: 4px 8px !important; border-radius: 4px !important; font-weight: 700 !important;">${badgeText}</span>
                </td>
                <td class="text-end" style="white-space: nowrap !important; vertical-align: middle !important; padding: 12px 14px !important;">
                    <div style="display: inline-flex !important; gap: 8px !important; justify-content: flex-end !important; align-items: center !important;">
                        <button class="btn-table-action btn-action-pass" title="Изменить мастер-пароль администратора" onclick="window.inlineChangePassword('${safeUsername}')">
                            <svg xmlns="http://w3.org" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m3.5 3.5L19 4"></path></svg>
                        </button>
                        <button class="btn-table-action btn-action-lock" ${disableBtnAttr} onclick="window.inlineToggleStatus(${r.id}, '${safeUsername}', ${r.is_active})">
                            ${lockIconHtml}
                        </button>
                        ${deleteButtonHtml}
                    </div>
                </td>
            </tr>`;
    });

    if (typeof renderPanelUsersPagination === 'function') {
        renderPanelUsersPagination(usersList.length);
    }
}

// =========================================================================
// 2.2 ДИНАМИЧЕСКИЙ РЕНДЕРИНГ ЦИФРОВЫХ КНОПОК ПАГИНАЦИИ
// =========================================================================
function renderPanelUsersPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / panelUsersPerPage);
    const container = document.getElementById('panelUsersPagination');
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;
    let html = '';
    
    if (currentPanelUsersPage > 1) {
        html += `<button class="btn btn-sm btn-outline-secondary me-1" onclick="window.changePanelUsersPage(${currentPanelUsersPage - 1}); return false;">« Назад</button> `;
    } else {
        html += `<button class="btn btn-sm btn-outline-secondary me-1" disabled style="opacity: 0.5; cursor: not-allowed !important;">« Назад</button> `;
    }
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPanelUsersPage) {
            html += `<button class="btn btn-sm btn-secondary active me-1" style="font-weight: 700 !important;" disabled>${i}</button> `;
        } else {
            html += `<button class="btn btn-sm btn-outline-secondary me-1" onclick="window.changePanelUsersPage(${i}); return false;">${i}</button> `;
        }
    }
    
    if (currentPanelUsersPage < totalPages) {
        html += `<button class="btn btn-sm btn-outline-secondary" onclick="window.changePanelUsersPage(${currentPanelUsersPage + 1}); return false;">Вперед »</button>`;
    } else {
        html += `<button class="btn btn-sm btn-outline-secondary" disabled style="opacity: 0.5; cursor: not-allowed !allowed !important;">Вперед »</button>`;
    }
    
    container.innerHTML = html;
}

// =========================================================================
// 3. УПРАВЛЕНИЕ СТРАНИЦАМИ И ИБ-УДАЛЕНИЕ ИЗ ТАБЛИЦЫ МОНИТОРИНГА
// =========================================================================
export function changePanelUsersPage(pageNumber) {
    currentPanelUsersPage = pageNumber;
    if (typeof renderPanelUsersTable === 'function' && globalPanelUsersCache.length > 0) {
        renderPanelUsersTable(globalPanelUsersCache);
    }
}

export async function inlineDeletePanelUser(id, username) {
    if (typeof id === 'string' && isNaN(Number(id))) {
        console.error("Обнаружен рассинхрон аргументов таблицы. Сработало ИБ-выравнивание.");
        showAlert('Критическая ошибка кэширования: таблица передает текстовый логин вместо числового ID. Перезагрузите страницу через Ctrl+F5.', 'danger');
        return;
    }
    const userId = Number(id);
    const targetName = username || id;
    if (!confirm(`Вы действительно хотите навсегда удалить администратора "${targetName}" (ID: ${userId})?`)) return;

    try {
        const response = await secureFetch(`/api/panel-users/${userId}/`, { method: 'DELETE' });
        const data = await response.json();
        if (response.ok) {
            showAlert(data.message || 'Администратор успешно удален', 'success');
            loadPanelUsers();
        } else {
            showAlert(data.detail || 'Ошибка удаления', 'danger');
        }
    } catch (err) {
        showAlert('Ошибка сети при удалении: ' + err.message, 'danger');
    }
}

export async function inlineChangePassword(username) {
    const new_password = prompt(`ВВЕДИТЕ НОВЫЙ ПАРОЛЬ ДЛЯ АДМИНИСТРАТОРА "${username}" (минимальная длина: 64 символа):`);
    if (new_password === null) return;
    if (!new_password) { showAlert('Пароль не может быть пустым!', 'warning'); return; }
 
    if (new_password.length < 64) {
        showAlert('Пароль должен быть не менее 64 символов в длину.', 'danger');
        return;
    }
    try {
        const response = await secureFetch('/api/panel-users/change-password/', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, new_password })
        });
        const data = await response.json();
        if (response.ok) { 
            showAlert('Пароль успешно обновлен!', 'success'); 
        } else { 
            showAlert(data.detail || 'Ошибка обновления пароля СУБД.', 'danger'); 
        }
    } catch (err) { 
        showAlert('Ошибка сети: ' + err.message, 'danger'); 
    }
}

export async function inlineToggleStatus(idOrUsername, usernameOrStatus, possibleStatus) {
    let username = "";
    let currentStatus = false;
    
    // Интеллектуальный ИБ-парсер аргументов: безошибочно вычисляем порядок прилёта
    if (typeof idOrUsername === 'number' || !isNaN(Number(idOrUsername))) {
        username = String(usernameOrStatus).trim();
        currentStatus = possibleStatus;
    } else {
        username = String(idOrUsername).trim();
        currentStatus = usernameOrStatus;
    }

    if (!username || username === "" || username === "undefined" || username === "null") {
        showAlert("🚨 Критическая ошибка рантайма: Не удалось извлечь текстовый логин администратора!", "danger");
        return;
    }

    // ЖЁСТКОЕ ПРИВЕДЕНИЕ ТИПОВ: Переводим статус в чистокровный boolean для схемы Pydantic v2
    const activeState = (currentStatus === true || currentStatus === 'true' || currentStatus === 1 || currentStatus === '1');
    const confirmText = activeState
        ? `Заблокировать администратора "${username}"?\nСотрудник больше не сможет войти в веб-панель менеджера прав!` 
        : `Разблокировать администратора "${username}"?`;
 
    if (!confirm(confirmText)) return;
    const nextActiveValue = !activeState;
    const payload = {
        username: username,
        is_active: nextActiveValue
    };
    try {
        const response = await secureFetch('/api/panel-users/toggle-status/', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
 
        if (response.ok) {
            showAlert(`✓ Статус администратора "${username}" успешно изменён!`, 'success');
            if (typeof loadPanelUsers === 'function') loadPanelUsers();
        } else {
            const data = await response.json();
            showAlert("🚨 Отказ ИБ-периметра бэкенда: " + (data.detail || "Ошибка изменения статуса"), 'danger');
        }
    } catch (err) { 
        showAlert('Ошибка сети при отправке пакета блокировки: ' + err.message, 'danger'); 
    }
}

// =========================================================================
// Динамическое управление required-валидацией полей
// =========================================================================
window.toggleAdminFieldsValidation = function() {
    const role = document.getElementById('panelUserRole')?.value;
    const srvInput = document.getElementById('panelUserAllowedServers');
    const roleInput = document.getElementById('panelUserAllowedRoles');
    
    if (!srvInput || !roleInput) return;

    if (role === "admin") {
        // АДМИНИСТРАТОР: Поля не требуются, гасим и пишем ALL
        srvInput.value = "ALL";
        srvInput.disabled = true; // <--- Правильная блокировка свойства
        srvInput.style.backgroundColor = '#e2e8f0'; // Tailwind серый фон
        
        roleInput.value = "ALL";
        roleInput.disabled = true;
        roleInput.style.backgroundColor = '#e2e8f0';
        
    } else if (role === "auditor") {
        // АУДИТОР ИБ: Поля не требуются, гасим и пишем ReadOnly маркер
        srvInput.value = "NONE (ReadOnly)";
        srvInput.disabled = true;
        srvInput.style.backgroundColor = '#e2e8f0';
        
        roleInput.value = "NONE (ReadOnly)";
        roleInput.disabled = true;
        roleInput.style.backgroundColor = '#e2e8f0';
        
    } else {
        // РОЛЬ (ИБ-офицер / Security_Manager): Поля ЖЁСТКО ТРЕБУЮТСЯ к заполнению
        if (srvInput.value === "ALL" || srvInput.value.includes("NONE")) srvInput.value = "";
        srvInput.disabled = false; // <--- ИБ-ФИКС: Снимаем блокировку
        srvInput.style.backgroundColor = '#ffffff'; // Белый активный фон
        
        if (roleInput.value === "ALL" || roleInput.value.includes("NONE")) roleInput.value = "";
        roleInput.disabled = false;
        roleInput.style.backgroundColor = '#ffffff';
    }
};


// =========================================================================
// БЕСПАРОЛЬНЫЙ НАКАТ ПАКЕТА ИЗ НОВОЙ ИБ-ПАНЕЛИ
// =========================================================================
export async function submitDirectIbLimitsUpdate() {
    // Считываем данные строго из 3 новых выделенных изолированных инпутов
    const username = document.getElementById('ibTargetUserLogin')?.value?.trim() || '';
    const serversRaw = document.getElementById('ibTargetAllowedServers')?.value?.trim() || '';
    const rolesRaw = document.getElementById('ibTargetAllowedRoles')?.value?.trim() || '';

    if (!username || username === "") {
        showAlert('⚠️ Ошибка ИБ: Введите имя учетной записи пользователя для обновления лимитов!', 'danger');
        return;
    }
    if (!serversRaw || !rolesRaw || serversRaw === "" || rolesRaw === "") {
        showAlert('🚨 Ошибка ИБ: Заполнение полей разрешенных серверов и ролей обязательно!', 'danger');
        return;
    }

    const serversArray = serversRaw.split(',').map(s => s.trim()).filter(Boolean);
    const rolesArray = rolesRaw.split(',').map(r => r.trim()).filter(Boolean);

    // Собираем ПОЛНЫЙ объект, добавляя скрытое поле роли и пустой пароль
    const payload = {
        username: username,
        allowed_servers: serversArray,
        allowed_target_roles: rolesArray
    };

    try {
        console.log("[ИБ НАДЗИРАТЕЛЬ] Отправка стерильного ИБ-пакета на новый роут:", payload);
        
        const response = await secureFetch('/api/admin/update-user-limits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();

        if (response.ok) {
            showAlert(data.message || `ИБ-матрица лимитов для пользователя "${username}" успешно обновлена в СУБД!`, 'success');
            
            // Очищаем новые инпуты после успешной отправки
            const inUser = document.getElementById('ibTargetUserLogin');
            const inSrv = document.getElementById('ibTargetAllowedServers');
            const inRls = document.getElementById('ibTargetAllowedRoles');
            if (inUser) inUser.value = '';
            if (inSrv) inSrv.value = '';
            if (inRls) inRls.value = '';

            // Мгновенно перезагружаем таблицу, если доступно
            if (typeof loadPanelUsers === 'function') loadPanelUsers();
        } else {
            showAlert(data.detail || 'Ошибка выполнения ИБ-операции на бэкенде.', 'danger');
        }
    } catch (err) {
        showAlert('Ошибка сети при прямом накате лимитов: ' + err.message, 'danger');
    }
}

window.submitDirectIbLimitsUpdate = submitDirectIbLimitsUpdate;



// Запускаем выравнивание полей при старте страницы
setTimeout(() => { if (typeof window.toggleAdminFieldsValidation === 'function') window.toggleAdminFieldsValidation(); }, 400);



