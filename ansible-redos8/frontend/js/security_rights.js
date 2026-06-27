// =========================================================================
// ИБ-КОНТУР ПАНЕЛИ
// =========================================================================
import { secureFetch, showAlert } from './config.js';

// Принудительно инициализируем глобальные маркеры шлюза в памяти ОЗУ
window.isIbSelectorLoading = false;
// =========================================================================
// 1. ПОДГРУЗКА СЕРВЕРОВ: ВЕЕРНОЕ НАПОЛНЕНИЕ ОБOИХ СЕЛЕКТOРОВ ИЗ СУБД
// =========================================================================
export async function securityLoadServersForSelect() {
    // Вытаскиваем оригинальный селектор 1-й вкладки
    const srvSelect = document.getElementById('secTargetServer') || document.getElementById('globalTargetServer');
    // Вытаскиваем суверенный селектор новой 2-й вкладки создания УЗ
    const targetSelectOnlyCreate = document.getElementById('secOnlyCreateTargetServer');
    
    if (!srvSelect && !targetSelectOnlyCreate) return;
    if (window.isIbSelectorLoading) return;
    window.isIbSelectorLoading = true;

    try {
        localStorage.removeItem('panel_user_allowed_servers');
        
        let rawAllowedServers = ''; 
        let cleanTargetUser = '';

        // [ИБ-ПЕРЕХВАТ JWT]: Декодируем токен строго по ключу pg_access_token
        const sessionToken = localStorage.getItem('pg_access_token') || 
                              localStorage.getItem('token') || 
                              localStorage.getItem('access_token') || '';
        
        if (sessionToken && sessionToken.includes('.')) {
            try {
                const parts = sessionToken.split('.');
                if (parts && parts[1]) {
                    const base64Url = parts[1]; // Снайперски изолируем Payload-строку
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    
                    const tokenData = JSON.parse(jsonPayload);
                    // Нативно вытаскиваем имя пользователя из полей sub или username
                    cleanTargetUser = String(tokenData.sub || tokenData.username || "").trim().toLowerCase();
                    console.log(`[ИБ НАДЗИРАТЕЛЬ] Логин успешно декодирован из pg_access_token: "${cleanTargetUser}"`);
                }
            } catch (e) { console.warn("[ИБ НАДЗИРАТЕЛЬ] Ошибка дешифрации JWT токена:", e); }
        }

        // Резервный шаг: если токен пуст, подстраховываемся текстовыми ключами ОЗУ
        if (!cleanTargetUser || cleanTargetUser === "") {
            const currentUsername = localStorage.getItem('username') || localStorage.getItem('user') || '';
            cleanTargetUser = String(currentUsername).trim().toLowerCase().replace(/^["']|["']$/g, '');
        }

        let mySessionUserId = null;

        // Запрашиваем веевный реестр допусков из API панели
        const userRes = await secureFetch('/api/admin/panel-users-list');
        if (userRes.ok) {
            const userData = await userRes.json();
            const usersList = userData.users || (Array.isArray(userData) ? userData : []);
            
            if (cleanTargetUser !== "") {
                const myProfileObj = usersList.find(u => String(u.username || "").trim().toLowerCase() === cleanTargetUser);
                mySessionUserId = myProfileObj ? Number(myProfileObj.id) : null;
            }
            
            console.log(`[ИБ НАДЗИРАТЕЛЬ] Итоговый скомпилированный user_id сессии оператора: ${mySessionUserId}`);

            // Строжайшая кадровая изоляция: Пропускаем строки СТРОГО при совпадении логина сессии
            const myServerRecords = usersList.filter(u => {
                const dbUser = String(u.username || "").trim().toLowerCase();
                if (cleanTargetUser && cleanTargetUser !== "" && cleanTargetUser !== "unknown") {
                    return dbUser === cleanTargetUser;
                }
                return false; // Защита периметра: чужие хосты на экран не пропускаем
            });

            const uniqueAssignedServers = new Set();
            myServerRecords.forEach(record => {
                const srvData = record.allowed_servers || record.servers || record.allowed_server_id || '';
                if (Array.isArray(srvData)) {
                    srvData.forEach(s => { if (s) uniqueAssignedServers.add(String(s).trim().toLowerCase()); });
                } else if (srvData && srvData !== "" && srvData !== "[object Object]") {
                    String(srvData).split(',').forEach(s => { if (s) uniqueAssignedServers.add(String(s).trim().toLowerCase()); });
                }
            });

            rawAllowedServers = Array.from(uniqueAssignedServers).join(',');
        }

        const cleanAllowedString = String(rawAllowedServers).trim().toLowerCase();
        let myAllowedServers = cleanAllowedString.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        console.log("[ИБ НАДЗИРАТЕЛЬ] Итоговый скомпилированный массив разрешенных хостов оператора:", myAllowedServers);

        const uniqueOptions = new Set();
        if (myAllowedServers.length > 0) {
            myAllowedServers.forEach(s => {
                if (s && s !== 'all' && s !== 'none_readonly' && s !== '[object object]') uniqueOptions.add(s.trim());
            });
        }

        let html = '<option value="" disabled selected>Выберите целевой сервер...</option>';

        // Обработка ситуации, когда лимитов хостов не обнаружено
        if (uniqueOptions.size === 0) {
            html = '<option value="" disabled selected>У вашего профиля нет разрешенных серверов</option>';
            if (srvSelect) { srvSelect.innerHTML = html; srvSelect.setAttribute('disabled', 'true'); }
            if (targetSelectOnlyCreate) { targetSelectOnlyCreate.innerHTML = html; targetSelectOnlyCreate.setAttribute('disabled', 'true'); }
            return;
        }

        // Сортируем хосты по алфавиту и генерируем чистые опции
        Array.from(uniqueOptions).sort().forEach(finalServerName => {
            html += `<option value="${finalServerName}">${finalServerName}</option>`; 
        });
        
        // 🟩 [ВЕЕРНЫЙ ИБ-ИНЖЕКТ]: Из одной общей функции прошиваем ОБА селектора
        if (srvSelect) {
            srvSelect.innerHTML = html;
            srvSelect.removeAttribute('disabled');
        }
        
        if (targetSelectOnlyCreate) {
            targetSelectOnlyCreate.innerHTML = html;
            targetSelectOnlyCreate.removeAttribute('disabled');
            console.log("🟩 [ИБ НАДЗИРАТЕЛЬ] Суверенный селектор второй вкладки успешно напитан хостами СУБД.");
        }
        
        localStorage.setItem('panel_user_allowed_servers', Array.from(uniqueOptions).join(','));

        // Автоматический выбор, если доступен ровно один инстанс кластера
        if (srvSelect && srvSelect.options.length === 2) {
            srvSelect.selectedIndex = 1;
            if (typeof window.securityOnServerChanged === 'function') window.securityOnServerChanged();
        }
        if (targetSelectOnlyCreate && targetSelectOnlyCreate.options.length === 2) {
            targetSelectOnlyCreate.selectedIndex = 1;
        }
    } catch (err) {
        console.error("🚨 Сбой подгрузки серверов ИБ напрямую из таблицы:", err);
        const errHtml = '<option value="" disabled selected>Ошибка загрузки серверов периметра</option>';
        if (srvSelect) { srvSelect.innerHTML = errHtml; srvSelect.setAttribute('disabled', 'true'); }
        if (targetSelectOnlyCreate) { targetSelectOnlyCreate.innerHTML = errHtml; targetSelectOnlyCreate.setAttribute('disabled', 'true'); }
    } finally { window.isIbSelectorLoading = false; }
}




// =========================================================================
// 2. ИЗМЕНЕНИЕ СЕРВЕРА ➔ НАПОЛНЕНИЕ НАТИВНОГО СЕЛЕКТОРА БАЗ ДАННЫХ
// =========================================================================
export async function securityOnServerChanged() {
    const srvSelect = document.getElementById('secTargetServer') || document.getElementById('globalTargetServer');
    const dbSelect = document.getElementById('secDatabase') || document.getElementById('globalDatabase');
    const roleSelect = document.getElementById('secRole') || document.getElementById('globalRole');
    const inlinePanel = document.getElementById('secInlinePanel');
    if (!srvSelect || !dbSelect) return;
    const serverId = srvSelect.value;
    if (!serverId) return;
    if (inlinePanel) inlinePanel.style.setProperty('display', 'none', 'important');
    
    dbSelect.innerHTML = '<option value="" disabled selected>Загрузка баз данных...</option>';
    dbSelect.setAttribute('disabled', 'true');
    if (roleSelect) {
        roleSelect.innerHTML = '<option value="" disabled selected>Сначала выберите базу...</option>';
        roleSelect.setAttribute('disabled', 'true');
    }
    try {
        const response = await window.secureFetch(`/api/get-target-databases/${serverId}`);
        if (!response.ok) { dbSelect.innerHTML = '<option value="" disabled selected>Инстанс недоступен</option>'; return; }
        const data = await response.json();
        const dbs = data.databases || data;
        let html = '<option value="" disabled selected>Выберите базу данных...</option>';
        if (Array.isArray(dbs)) { dbs.forEach(db => { html += `<option value="${db}">${db}</option>`; }); }
        dbSelect.innerHTML = html;
        dbSelect.removeAttribute('disabled');
    } catch (err) { console.error("🚨 Сбой каскада баз данных:", err); }
}
// =========================================================================
// 3. ИЗМЕНЕНИЕ БАЗЫ ➔ НАПОЛНЕНИЕ НАТИВНОГО СЕЛЕКТОРА ПОЛЬЗОВАТЕЛЕЙ СУБД
// =========================================================================
export async function securityOnDatabaseChanged() {
    const srvSelect = document.getElementById('secTargetServer') || document.getElementById('globalTargetServer');
    const dbSelect = document.getElementById('secDatabase') || document.getElementById('globalDatabase');
    const roleSelect = document.getElementById('secRole') || document.getElementById('globalRole');
    const inlinePanel = document.getElementById('secInlinePanel');
    
    if (!srvSelect || !dbSelect || !roleSelect) return;
    const srvId = srvSelect.value;
    const dbName = dbSelect.value;
    if (!srvId || !dbName) return;
    
    if (inlinePanel) inlinePanel.style.setProperty('display', 'none', 'important');
    roleSelect.innerHTML = '<option value="" disabled selected>Загрузка пользователей СУБД...</option>';
    roleSelect.setAttribute('disabled', 'true');
    
    try {
        const [resCustom, resSystem] = await Promise.all([
            window.secureFetch(`/api/get-target-roles/${srvId}?show_system=false`),
            window.secureFetch(`/api/get-target-roles/${srvId}?show_system=true`)
        ]);
        const uniqueUsers = new Set();
        if (resCustom.ok) {
            const dataCustom = await resCustom.json();
            const customRoles = dataCustom.roles || dataCustom.data || [];
            if (Array.isArray(customRoles)) {
                customRoles.forEach(r => { uniqueUsers.add(typeof r === 'object' ? (r.rolname || r.name || "") : String(r)); });
            }
        }
        if (resSystem.ok) {
            const dataSystem = await resSystem.json();
            const systemRoles = dataSystem.roles || dataSystem.data || [];
            if (Array.isArray(systemRoles)) {
                systemRoles.forEach(r => {
                    const clean = typeof r === 'object' ? (r.rolname || r.name || "") : String(r);
                    const low = clean.toLowerCase();
                    const rawRolesLimit = localStorage.getItem('panel_user_allowed_roles') || 'pg_checkpoint';
                    const myAllowedRoles = String(rawRolesLimit).split(',').map(x => x.trim().toLowerCase());
                    if (low === 'postgres' || myAllowedRoles.includes(low) || myAllowedRoles.includes('all')) { uniqueUsers.add(clean); }
                });
            }
        }
        uniqueUsers.add('postgres');
        let html = '<option value="" disabled selected>Выберите пользователя СУБД...</option>';
        Array.from(uniqueUsers).sort().forEach(user => { html += `<option value="${user}">${user}</option>`; });
        roleSelect.innerHTML = html;
        roleSelect.removeAttribute('disabled');
    } catch (err) { console.error("🚨 Краш ИБ-сканирования ролей кластера:", err); }
}
// =========================================================================
// 4. РЕАКТИВНЫЙ ОБРАБОТЧИК: ДИНАМИЧЕСКИЙ СБОР ВСЕХ РАЗРЕШЕННЫХ РОЛЕЙ ОПЕРАТОРА ПО user_id
// =========================================================================
export async function securityOnUserSelected() {
    const srvSelect = document.getElementById('secTargetServer') || document.getElementById('globalTargetServer');
    const dbSelect = document.getElementById('secDatabase') || document.getElementById('globalDatabase');
    const roleSelect = document.getElementById('secRole') || document.getElementById('globalRole');
    
    const server = srvSelect ? srvSelect.value : '';
    const db = dbSelect ? dbSelect.value : '';
    const user = roleSelect ? roleSelect.value : '';
    
    const inlinePanel = document.getElementById('secInlinePanel');
    const contextPlacard = document.getElementById('secInlineContextInfo');
    const inlineSelect = document.getElementById('secInlineRoleSelect');
    const submitBtn = document.getElementById('secInlineSubmitBtn');

    if (!server || !db || !user || user === "") {
        if (inlinePanel) inlinePanel.style.setProperty('display', 'none', 'important');
        return;
    }
 
    if (contextPlacard) {
        contextPlacard.innerHTML = `Сервер: <span style="color:#2563eb; font-weight:800;">${server}</span> | База: <span style="color:#2563eb; font-weight:800;">${db}</span> | Цель: <span style="color:#2563eb; font-weight:800;">${user}</span>`;
    }
 
    try {
        let activeRoleForDisplay = ''; 
        let currentOperatorName = '';

         // =========================================================================
        // [ИБ НАДЗИРАТЕЛЬ]: JWT-ПЕРЕХВАТ ДЛЯ ВТОРОЙ ФУНКЦИИ
        // =========================================================================
        const sessionToken = localStorage.getItem('pg_access_token') || 
                              localStorage.getItem('token') || 
                              localStorage.getItem('access_token') || '';
        
        if (sessionToken && sessionToken.includes('.')) {
            try {
                const parts = sessionToken.split('.');
                if (parts && parts[1]) {
                    const base64Url = parts[1]; // Извлекаем Payload строго как строку
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    
                    const tokenData = JSON.parse(jsonPayload);
                    // Нативно забираем логин из JWT-полей sub или username
                    currentOperatorName = String(tokenData.sub || tokenData.username || tokenData.user || "").trim().toLowerCase();
                    console.log(`[ИБ НАДЗИРАТЕЛЬ РОЛИ] Оператор успешно декодирован из JWT: "${currentOperatorName}"`);
                }
            } catch (e) {
                console.warn("[ИБ НАДЗИРАТЕЛЬ] Ошибка дешифрации токена во второй функции:", e);
            }
        }

        const cleanOpName = String(currentOperatorName).trim().toLowerCase().replace(/^["']|["']$/g, '');

 
        // Стучимся к нашему выпрямленному API бэкенда с LEFT JOIN
        const userRes = await secureFetch('/api/admin/panel-users-list');
        if (userRes.ok) {
            const userData = await userRes.json();
            const usersList = userData.users || (Array.isArray(userData) ? userData : []);
            
            // Динамически вычисляем числовой user_id текущего оператора панели
            const myProfileObj = usersList.find(u => String(u.username || "").trim().toLowerCase() === cleanOpName);
            const mySessionUserId = myProfileObj ? Number(myProfileObj.id) : null;
            console.log(`[ИБ НАДЗИРАТЕЛЬ РОЛИ] Оператор: "${cleanOpName}" -> Числовой user_id в СУБД: ${mySessionUserId}`);

            if (mySessionUserId) {
                // Выгребаем абсолютно ВСЕ веерные строки ролей, привязанные строго к нашему user_id
                const myRecords = usersList.filter(u => {
                    const recordUserId = u.user_id ? Number(u.user_id) : (u.id ? Number(u.id) : null);
                    return recordUserId === mySessionUserId;
                });

                if (myRecords.length > 0) {
                    // Извлекаем allowed_target_role строго по имени поля
                    const collectedRoles = myRecords.map(r => {
                        const val = r.allowed_target_role || r.allowed_target_roles || r.roles || '';
                        return Array.isArray(val) ? val.join(',') : String(val);
                    }).filter(Boolean);

                    activeRoleForDisplay = collectedRoles.join(',');
                }
            }
        }

        // Резервный фолбек на глобальный ОЗУ кэш, если сеть занята
        if ((!activeRoleForDisplay || activeRoleForDisplay === "") && window.globalPanelUsersCache && window.globalPanelUsersCache.length > 0) {
            const cacheRecords = window.globalPanelUsersCache.filter(u => 
                String(u.username || "").trim().toLowerCase() === cleanOpName
            );
            
            const uniqueCacheSet = new Set();
            cacheRecords.forEach(record => {
                const rlsData = record.allowed_target_role || record.allowed_target_roles || record.roles || '';
                if (Array.isArray(rlsData)) {
                    rlsData.forEach(r => uniqueCacheSet.add(String(r).trim().toLowerCase()));
                } else if (rlsData && rlsData !== "") {
                    String(rlsData).split(',').forEach(r => uniqueCacheSet.add(String(r).trim().toLowerCase()));
                }
            });
            activeRoleForDisplay = Array.from(uniqueCacheSet).join(',');
        }

        // Распиливаем чистую строку лимитов ролей в JavaScript ОЗУ-массив строк
        const myAllowedRoles = String(activeRoleForDisplay).split(',')
            .map(r => r.trim().toLowerCase().replace(/^["']|["']$/g, ''))
            .filter(r => r && r !== "" && !r.includes('none'));
            
        console.log(`[ИБ НАДЗИРАТЕЛЬ] Итоговый скомпилированный веерный пул ролей оператора:`, myAllowedRoles);

        // Если ролей в базе нет — блокируем контур
        if (myAllowedRoles.length === 0) {
            if (inlineSelect) {
                inlineSelect.innerHTML = '<option value="" disabled selected>У вашего профиля нет разрешённых ролей для назначения</option>';
                inlineSelect.setAttribute('disabled', 'true');
                inlineSelect.style.setProperty('border-color', '#ef4444', 'important');
                inlineSelect.style.setProperty('color', '#ef4444', 'important');
            }
            if (submitBtn) { 
                submitBtn.setAttribute('disabled', 'true'); 
                submitBtn.style.opacity = "0.5"; 
            }
            if (inlinePanel) inlinePanel.style.setProperty('display', 'flex', 'important');
            return; 
        }

        // РЕЖИМ СУВЕРЕННОГО ДОПУСКА: Открываем выпадающий список ролей
        const uniqueRolesSet = new Set(myAllowedRoles);
        const finalUniqueRolesList = Array.from(uniqueRolesSet).sort();

        console.log(`[ИБ НАДЗИРАТЕЛЬ] Роли успешно сгруппированы в ОЗУ:`, finalUniqueRolesList);

        let html = '<option value="" disabled selected>Выберите системную роль...</option>';
        finalUniqueRolesList.forEach(role => {
            html += `<option value="${role}">${role}</option> `;
        });

        if (inlineSelect) {
            inlineSelect.innerHTML = html;
            inlineSelect.removeAttribute('disabled');
            inlineSelect.style.setProperty('border-color', '#cbd5e1', 'important');
            inlineSelect.style.setProperty('color', '#1e293b', 'important');
            if (inlineSelect.options.length === 2) { inlineSelect.selectedIndex = 1; }
        }
 
        if (submitBtn) {
            submitBtn.removeAttribute('disabled');
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
        }
 
        if (inlinePanel) {
            inlinePanel.style.setProperty('display', 'flex', 'important');
            console.log(`[ИБ НАДЗИРАТЕЛЬ] Все веерные роли из матрицы СУБД успешно выведены на плиту.`);
        }
    } catch (err) { 
        console.error("🚨 Сбой рантайм-наполнения ИБ-панели ролей:", err); 
    }
}



// =========================================================================
// 5. ОБРАБОТЧИК КНОПКИ «ВЫПОЛНИТЬ»: ИСПРАВЛЕННЫЙ ИБ-КОНТУР ДЛЯ ИБ-ОФИЦЕРА
// =========================================================================
export async function secSubmitCustomRoleAssign(event) {
    // ЖЕСТКИЙ ЗАТВОР: Блокируем дефолтную перезагрузку страницы браузером
    if (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
    } else if (window.event) {
        window.event.preventDefault();
    }

    const srvSelect = document.getElementById('secTargetServer') || document.getElementById('globalTargetServer');
    const dbSelect = document.getElementById('secDatabase') || document.getElementById('globalDatabase');
    const roleSelect = document.getElementById('secRole') || document.getElementById('globalRole');
    const selectedRole = document.getElementById('secInlineRoleSelect')?.value;

    // [ЖЕСТКИЙ ПЕРЕХВАТ СЕЛЕКТОРА]: Считываем выбранный режим (GRANT или REVOKE)
    const actionSelect = document.getElementById('secRoleActionSelect');
    const currentAction = actionSelect ? actionSelect.value : 'GRANT';

    if (!srvSelect || !dbSelect || !roleSelect) return;
    const server = srvSelect.value;
    const db = dbSelect.value;
    const user = roleSelect.value;

    if (!selectedRole) {
        showAlert("🔒 Пожалуйста, выберите системную роль из выпадающего списка!", "warning");
        return;
    }

    const submitBtn = document.getElementById('secInlineSubmitBtn');
    if (submitBtn) {
        submitBtn.setAttribute('disabled', 'true');
        submitBtn.innerText = 'Запись в базу...';
    }

    try {
        let foundUsername = '';
        const sessionToken = localStorage.getItem('pg_access_token') || localStorage.getItem('token') || '';

        // ИБ-РАСПИЛ JWT ТОКЕНА БЕЗ ОШИБОК ВЕРСТКИ
        if (sessionToken && sessionToken.includes('.')) {
            try {
                const base64Url = sessionToken.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%'
                    + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                const tokenData = JSON.parse(jsonPayload);
                foundUsername = String(tokenData.sub || tokenData.username || "").trim().toLowerCase();
            } catch (e) {
                console.warn("[ИБ НАДЗИРАТЕЛЬ] Резервный переход из-за парсинга JWT:", e);
            }
        }

        // Вытаскиваем логин из текстовых ключей ОЗУ Хрома
        if (!foundUsername || foundUsername === "") {
            foundUsername = localStorage.getItem('username') ||
                localStorage.getItem('user') ||
                localStorage.getItem('login') ||
                sessionStorage.getItem('username') ||
                window.currentActiveUser || '';
        }

        // Резервный шаг: если в ОЗУ пусто, читаем текстовый лог DOM-профиля шапки экрана
        if (!foundUsername || foundUsername === "") {
            const profileText = document.querySelector('.user-profile-name') ||
                document.getElementById('profileUsername') || document.querySelector('.nav-user-name');
            if (profileText && profileText.innerText) {
                foundUsername = profileText.innerText.trim();
            }
        }

        // Жесткий стоп-затвор ИБ: если имя оператора вообще не определилось — наглухо рубим накат ролей
        if (!foundUsername || foundUsername === "" || foundUsername === "unknown") {
            showAlert("🚨 ИБ-Отказ: Не удалось динамически идентифицировать вашу active сессию для журнала аудита!", "danger");
            if (submitBtn) {
                submitBtn.removeAttribute('disabled');
                submitBtn.innerText = 'Выполнить';
            }
            return;
        }

        const finalOperator = String(foundUsername).replace(/^["']|["']$/g, '').trim().toLowerCase();

        // Action теперь ЖЕСТКО отправляет выбранный currentAction (GRANT или REVOKE)
        const universalPayload = {
            username: user,
            target_server: server,
            database: db,
            system_role: selectedRole,
            action: currentAction,
            operator: finalOperator
        };

        console.log("[ИБ НАДЗИРАТЕЛЬ НАКАТ] Отправка пакета наката прав на бэкенд FastAPI:", universalPayload);

        const response = await window.secureFetch('/api/manage-system-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(universalPayload)
        });

        if (response.ok) {
            const successMsg = currentAction === 'GRANT' ? 'делегирована пользователю' : 'отозвана у пользователя';
            showAlert(`🔒 Успешно! Системная группа ролей "${selectedRole}" успешно ${successMsg} "${user}" и сохранена в СУБД!`, "success");

            // -------------------------------------------------------------------------
            // ИБ-ФИКС: УДАЛЕН СБРОС СЕРВЕРА И БАЗЫ, ЧТОБЫ ШТОРКА НЕ ИСЧЕЗАЛА
            // -------------------------------------------------------------------------
            const inlineSelect = document.getElementById('secInlineRoleSelect');
            if (inlineSelect) {
                inlineSelect.selectedIndex = 0; // Мягко сбрасываем только выбор роли в дефолт
            }

            if (typeof window.loadPanelUsers === 'function') window.loadPanelUsers();
            
            // Динамически перевызываем сбор ролей для обновления инфо-плаката
            if (typeof window.securityOnUserSelected === 'function') window.securityOnUserSelected();

        } else {
            const errData = await response.json();
            showAlert(`🚨 Ошибка СУБД панели: ${errData.detail || 'Сбой трансляции прав'}`, "danger");
        }
    } catch (err) {
        showAlert("🚨 Не удалось связаться с сервером привилегий.", "danger");
    } finally {
        if (submitBtn) {
            submitBtn.removeAttribute('disabled');
            submitBtn.innerText = 'Выполнить';
        }
    }
}


// =========================================================================
// 6. ИЗОЛИРОВАННОЕ СОЗДАНИЕ УЗ ДЛЯ SECURITY_MANAGER
// =========================================================================
export async function securitySubmitOnlyCreateUser(event) {
    if (event) event.preventDefault();

    const server = document.getElementById('secOnlyCreateTargetServer')?.value;
    const username = document.getElementById('secOnlyCreateUsername')?.value?.trim();
    const email = document.getElementById('secOnlyCreateEmail')?.value?.trim();
    const submitBtn = document.getElementById('btnSecOnlyCreateSubmit');

    if (!server || !username || !email) { showAlert("⚠️ Заполните все поля формы!", "warning"); return; }
    if (submitBtn) { submitBtn.setAttribute('disabled', 'true'); submitBtn.innerText = 'Создание...'; }

    try {
        let currentOp = '';
        const sessionToken = localStorage.getItem('pg_access_token') || localStorage.getItem('token') || '';
        
        if (sessionToken && sessionToken.includes('.')) {
            try {
                const parts = sessionToken.split('.');
                const base64Url = parts[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const parsed = JSON.parse(jsonPayload);
                currentOp = String(parsed.sub || parsed.username || '').trim().toLowerCase();
            } catch(e) { console.warn(e); }
        }

        // Вытаскиваем логин из текстовых ключей ОЗУ Хрома
        if (!currentOp || currentOp === "") {
            currentOp = localStorage.getItem('username') || 
                        localStorage.getItem('user') || 
                        localStorage.getItem('login') || 
                        sessionStorage.getItem('username') || 
                        window.currentActiveUser || '';
        }

        // Резервный шаг: если в ОЗУ пусто, читаем текстовый лог DOM-профиля шапки экрана
        if (!currentOp || currentOp === "") {
            const profileText = document.querySelector('.user-profile-name') || document.getElementById('profileUsername') || document.querySelector('.nav-user-name');
            if (profileText && profileText.innerText) {
                currentOp = profileText.innerText.trim();
            }
        }

        // Жесткий стоп-затвор ИБ: если имя оператора вообще не определилось — наглухо рубим создание
        if (!currentOp || currentOp === "" || currentOp === "unknown") {
            showAlert("🚨 ИБ-Отказ: Не удалось динамически идентифицировать вашу активную сессию для журнала аудита!", "danger");
            if (submitBtn) { submitBtn.removeAttribute('disabled'); submitBtn.innerText = 'Создать учётную запись'; }
            return;
        }


        const finalOperatorName = String(currentOp).trim().toLowerCase().replace(/^["']|["']$/g, '');

        const payload = {
            target_server: server, db_user_name: username, employee_email: email, action_mode: "CREATE_ONLY", operator: finalOperatorName
        };
        console.log("[ИБ НАДЗИРАТЕЛЬ СОЗДАНИЕ] Отправка пакета создания роли в СУБД:", payload);

        const response = await window.secureFetch('/api/manage-postgres-users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showAlert(`✅ Успешно! Роль "${username}" сгенерирована. Пароль выслан на почту.`, "success");
            if (document.getElementById('secOnlyCreateUsername')) document.getElementById('secOnlyCreateUsername').value = '';
            if (document.getElementById('secOnlyCreateEmail')) document.getElementById('secOnlyCreateEmail').value = '';
        } else {
            const err = await response.json();
            showAlert(`🚨 Отказ СУБД: ${err.detail || 'Сбой'}`, "danger");
        }
    } catch (err) { 
        showAlert("🚨 Ошибка сети при связи с бэкендом.", "danger"); 
    } finally { 
        if (submitBtn) { 
            submitBtn.removeAttribute('disabled'); 
            submitBtn.innerText = 'Создать учётную запись'; 
        } 
    }
}



// =========================================================================
// // [ИБ НАДЗИРАТЕЛЬ]: ФИНАЛЬНАЯ ГЛЯНЦЕВАЯ СИНХРОНИЗАЦИЯ ПРОФИЛЯ СЕССИИ В ШАПКЕ
// =========================================================================
function renderActiveUserProfileBadge() {
    const loginText = document.getElementById("ibActiveUserLogin");
    const roleBadge = document.getElementById("ibActiveUserRoleBadge");
    if (!loginText || !roleBadge) return;

    let cleanUser = 'unknown';
    let cleanRole = 'security_manager';

    // 🔐 [СНАЙПЕРСКИЙ JWT-ПЕРЕХВАТ]: Пытаемся нативно декодировать Payload
    const sessionToken = localStorage.getItem('pg_access_token') || 
                         localStorage.getItem('token') || 
                         localStorage.getItem('access_token') || '';

    if (sessionToken && sessionToken.includes('.')) {
        try {
            const parts = sessionToken.split('.');
            if (parts && parts[1]) {
                let base64Url = parts[1];
                let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                
                // Выравнивание длины строки под требования atob
                while (base64.length % 4 !== 0) {
                    base64 += '=';
                }
                
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                
                const tokenData = JSON.parse(jsonPayload);
                if (tokenData) {
                    cleanUser = String(tokenData.sub || tokenData.username || 'unknown').trim();
                    cleanRole = String(tokenData.role || 'security_manager').trim().toLowerCase();
                }
            }
        } catch (e) {
            console.warn("[ИБ НАДЗИРАТЕЛЬ] Ошибка парсинга JWT, включаем резервную страховку:", e);
        }
    }

    // 🛡️ Если JWT упал или пустой, берем данные напрямую из ОЗУ Хрома
    if (!cleanUser || cleanUser === 'unknown' || cleanUser === 'панель') {
        cleanUser = localStorage.getItem('username') || 
                    localStorage.getItem('user') || 
                    localStorage.getItem('login') || 
                    sessionStorage.getItem('username') || 
                    window.currentActiveUser || 'Оператор';
    }

    if (!cleanRole || cleanRole === 'security_manager') {
        const rawRole = localStorage.getItem('panel_user_role') || 
                         localStorage.getItem('user_role') || 
                         localStorage.getItem('role') || 
                         'security_manager';
        cleanRole = String(rawRole).trim().toLowerCase();
    }

    // Выводим очищенный логин в текстовое поле нашего бейджа (Слово "загрузка..." стирается!)
    loginText.innerText = String(cleanUser).trim();

    // Удаляем Bootstrap класс badge, чтобы исключить конфликт стилей
    roleBadge.classList.remove('badge');

    // 🎨 [ДИЗАЙНЕРСКОЕ ИБ-АТЕЛЬЕ]: Отрисовка цветов
    if (cleanRole.includes('admin')) {
        roleBadge.innerText = '🛡️ АДМИНИСТРАТОР';
        roleBadge.style.setProperty('background-color', '#fef3c7', 'important');
        roleBadge.style.setProperty('color', '#d97706', 'important');
        roleBadge.style.setProperty('border', '1px solid #fde68a', 'important');
    } else if (cleanRole.includes('auditor')) {
        roleBadge.innerText = '👁️ АУДИТОР';
        roleBadge.style.setProperty('background-color', '#f1f5f9', 'important');
        roleBadge.style.setProperty('color', '#475569', 'important');
        roleBadge.style.setProperty('border', '1px solid #cbd5e1', 'important');
    } else {
        roleBadge.innerText = '🛡️ МЕНЕДЖЕР';
        roleBadge.style.setProperty('background-color', '#d1fae5', 'important');
        roleBadge.style.setProperty('color', '#065f46', 'important');
        roleBadge.style.setProperty('border', '1px solid #a7f3d0', 'important');
    }

}

// Пробрасываем мост на шину window для сквозной совместимости
window.renderActiveUserProfileBadge = renderActiveUserProfileBadge;


// =========================================================================
// [ИБ НАДЗИРАТЕЛЬ]: НАТИВНЫЙ БЕЗАВАРИЙНЫЙ ТРИГГЕР ПОДГРУЗКИ ХОСТОВ
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const createTabBtn = document.getElementById('securityCreateUser-tab');
    if (createTabBtn) {
        createTabBtn.addEventListener('click', () => {
            // При клике на зеленую вкладку вызываем strictly главную рабочую функцию!
            if (typeof securityLoadServersForSelect === 'function') securityLoadServersForSelect();
        });
    }
    // Холодный старт: веером накатываем хосты на обе плиты через 1 секунду после загрузки DOM
    setTimeout(() => { 
        if (typeof securityLoadServersForSelect === 'function') securityLoadServersForSelect(); 
    }, 1000);
});



// =========================================================================
// МОСТЫ К ОЗУ WINDOW
// =========================================================================
window.securityLoadServersForSelect = securityLoadServersForSelect;
window.securityOnServerChanged = securityOnServerChanged;
window.securityOnDatabaseChanged = securityOnDatabaseChanged;
window.securityOnUserSelected = securityOnUserSelected;
window.secSubmitCustomRoleAssign = secSubmitCustomRoleAssign;
window.securitySubmitOnlyCreateUser = securitySubmitOnlyCreateUser;
