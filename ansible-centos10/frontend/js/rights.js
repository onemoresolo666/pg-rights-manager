import { secureFetch, showAlert } from './config.js';
import { loadServersForSelect } from './servers.js';

let currentAuditPage = 1;
const auditPageSize = 20;

// =========================================================================
// СБОР БАЗ ДАННЫХ НА УРОВНЕ СЕРВЕРА
// =========================================================================
export async function onServerChanged() {
    const serverInput = document.getElementById('globalTargetServer');
    if (!serverInput) return;
    
    const serverId = serverInput.value.trim();
    const dbInput = document.getElementById('globalDatabase');
    const dbDatalist = document.getElementById('globalDatabaseDatalist');
    const roleInput = document.getElementById('globalRole');
    const roleDatalist = document.getElementById('globalRoleDatalist');
    
    // -------------------------------------------------------------------------
    // ЖЁСТКИЙ ИБ-БАРЬЕР: Игнорируем пустые строки, русские буквы и обрубки менее 3-х символов
    // -------------------------------------------------------------------------
    if (!serverId || 
        serverId.length < 3 || 
        serverId.includes("Выберите") || 
        serverId.includes("Загрузка") || 
        /[а-яА-Я]/.test(serverId)) { 
        
        // Тихо и безопасно зачищаем буферы каскада и стопорим трансляцию пакетов в сеть!
        if (dbInput) { dbInput.value = ''; dbInput.setAttribute('disabled', 'true'); dbInput.placeholder = 'Сначала выберите сервер...'; }
        if (dbDatalist) dbDatalist.innerHTML = '';
        if (roleInput) { roleInput.value = ''; roleInput.setAttribute('disabled', 'true'); roleInput.placeholder = 'Сначала выберите сервер...'; }
        if (roleDatalist) roleDatalist.innerHTML = '';
        return; 
    }
    
    if (dbInput) dbInput.placeholder = 'Сбор баз данных кластера...';
    
    try {
        // Асинхронный fetch-пакет на бэкенд за списком реальных баз данных инстанса
        const response = await secureFetch(`/api/get-target-databases/${serverId}`);
        if (!response.ok) {
            if (dbInput) dbInput.placeholder = 'Инстанс СУБД недоступен';
            return;
        }
        
        const data = await response.json();
        const dbs = data.databases || data;
        
        let html = '';
        // Автоматически добавляем Enterprise-опцию "ALL" для веерного применения прав на все базы сразу
        html += `<option value="ALL">ВСЕ БАЗЫ ДАННЫХ (ALL)</option>`;
        
        if (Array.isArray(dbs)) {
            dbs.forEach(db => { html += `<option value="${db}"></option>`; });
        }
        
        // Инжектим опции в дата-лист баз данных Вкладки №2
        if (dbDatalist) dbDatalist.innerHTML = html;
        
        if (dbInput) {
            dbInput.removeAttribute('disabled');
            dbInput.placeholder = 'Начните вводить базу...';
            dbInput.value = '';
            
            // Навешиваем ИБ-слушатель ввода на инпут баз для активации третьего каскада (ролей и схем)
            dbInput.removeEventListener('input', onDatabaseChanged);
            dbInput.addEventListener('input', onDatabaseChanged);
        }
        
        console.log(`[ИБ АВТОМАТИКА] Каскад баз данных для сервера "${serverId}" успешно подгружен!`);
    } catch (err) {
        console.error(`🚨 Ошибка при каскадном получении баз данных для "${serverId}":`, err);
        if (dbInput) dbInput.placeholder = 'Ошибка загрузки баз СУБД';
    }
}



// =========================================================================
// ФИЛЬТР И КАСКАД БАЗ ДАННЫХ
// =========================================================================
export async function onDatabaseChanged() {
    const srvId = document.getElementById('globalTargetServer')?.value?.trim();
    const dbName = document.getElementById('globalDatabase')?.value?.trim();

    const roleInput = document.getElementById('globalRole');
    const roleDatalist = document.getElementById('globalRoleDatalist');

    const sSelect = document.getElementById('schemaTarget');
    const tSelect = document.getElementById('tableSchemaTarget');
    const tInput = document.getElementById('tableNameTarget');
    const seqSelect = document.getElementById('seqSchemaTarget');
    const seqInput = document.getElementById('seqNameTarget');

    // -------------------------------------------------------------------------
    // ИБ-БАРЬЕР При пустой базе отключаем поле, но НЕ стираем выбранную роль!
    // -------------------------------------------------------------------------
    if (!srvId || !dbName || dbName === "") {
        if (roleInput) { 
            roleInput.setAttribute('disabled', 'true');
            roleInput.placeholder = 'Сначала выберите базу...'; 
        }
        if (roleDatalist) roleDatalist.innerHTML = '';
        return;
    }

    if (roleInput) roleInput.placeholder = 'Сбор учётных записей кластера...';

    // -------------------------------------------------------------------------
    // ПОТОК №1: ПОДГРУЗКА ПОЛЬЗОВАТЕЛЕЙ (РОЛЕЙ) В НАШ ТРЕТИЙ ИНПУТ АВТОКОМПЛИТА
    // -------------------------------------------------------------------------
    try {
        const rRes = await secureFetch(`/api/get-target-roles/${srvId}?show_system=false`);
        if (rRes.ok) {
            const rData = await rRes.json();
            const roles = rData.roles || rData;

            let rolesHtml = '';
            if (Array.isArray(roles)) {
                roles.forEach(role => { rolesHtml += `<option value="${role}"></option>`; });
            }

            if (roleDatalist) roleDatalist.innerHTML = rolesHtml;

            if (roleInput) {
                roleInput.removeAttribute('disabled');
                roleInput.placeholder = 'Начните вводить пользователя...';
            }
        }
    } catch (err) {
        console.error("🚨 Ошибка при точечном каскадном получении ролей:", err);
    }

    // -------------------------------------------------------------------------
    // ПОТОК №2: ПОДГРУЗКА СХЕМ ДЛЯ НИЖНИХ ЯРУСОВ
    // -------------------------------------------------------------------------
    if (dbName === 'ALL') {
        if (sSelect) { sSelect.innerHTML = '<option value="ALL" selected>BCE CXEMЫ (ALL)</option>'; sSelect.multiple = false; sSelect.size = 1; }
        if (tSelect) tSelect.innerHTML = '<option value="ALL" selected>BCE CXEMЫ (ALL)</option>';
        if (tInput) { tInput.value = 'ALL'; tInput.disabled = true; }
        
        // ИБ-ФИКС ДЛЯ СИКВЕНСОВ: Насильно включаем режим ALL на уровне SEQUENCE
        if (seqSelect) seqSelect.innerHTML = '<option value="ALL" selected>BCE CXEMЫ (ALL)</option>';
        if (seqInput) { seqInput.value = 'ALL'; seqInput.disabled = true; }
        return;
    }

    // Возврат интерфейса в исходное состояние, если выбрана конкретная база данных
    if (sSelect) { sSelect.multiple = true; sSelect.size = 3; }
    if (tInput) { tInput.disabled = false; if (tInput.value === 'ALL') tInput.value = ''; }
    if (seqInput) { seqInput.disabled = false; if (seqInput.value === 'ALL') seqInput.value = ''; }

    try {
        const res = await secureFetch(`/api/get-target-schemas/${srvId}?db=${dbName}`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (data.schemas) {
            if (sSelect) sSelect.innerHTML = '';
            if (tSelect) tSelect.innerHTML = '';
            if (seqSelect) seqSelect.innerHTML = ''; // Очищаем селект сиквенсов
            
            data.schemas.forEach(s => {
                const sel = s === 'public' ? 'selected' : '';
                if (sSelect) sSelect.innerHTML += `<option value="${s}" ${sel}>${s}</option>`;
                if (tSelect) tSelect.innerHTML += `<option value="${s}" ${sel}>${s}</option>`;
                if (seqSelect) seqSelect.innerHTML += `<option value="${s}" ${sel}>${s}</option>`; // Наполняем сиквенсы
            });
        }
    } catch (err) {
        if (sSelect) sSelect.innerHTML = '<option value="public">public</option>';
        if (tSelect) tSelect.innerHTML = '<option value="public">public</option>';
        if (seqSelect) seqSelect.innerHTML = '<option value="public">public</option>';
    }

    setTimeout(() => { 
        if (typeof onTableSchemaChanged === 'function') onTableSchemaChanged(); 
    }, 100);
}



export async function onTableSchemaChanged() {
    const srvId = document.getElementById('globalTargetServer').value;
    const dbName = document.getElementById('globalDatabase').value;
    const schName = document.getElementById('tableSchemaTarget').value;
    if (!srvId || !dbName || !schName || dbName === 'ALL') return;
    try {
        await secureFetch(`/api/get-target-tables/${srvId}?db=${dbName}&schema=${schName}`);
    } catch { console.error("Ошибка обновления метаданных таблиц"); }
}

// =========================================================================
// ВЕЕРНЫЙ ОБРАБОТЧИК НАКАТКИ ПРАВ (ЧАСТЬ 1)
// =========================================================================
export async function submitForm(event, scope) {
    if (event) event.preventDefault();

    // 1. Извлекаем текстовые значения напрямую из глобальных инпутов автокомплита
    const server = document.getElementById('globalTargetServer')?.value?.trim();
    const dbName = document.getElementById('globalDatabase')?.value?.trim();
    const role = document.getElementById('globalRole')?.value?.trim();

    // Валидация заполнения ключевых полей периметра конфигурации СУБД
    if (!server || !dbName || !role) {
        alert('Заполните ключевые поля конфигурации (Сервер, База данных, Пользователь)!');
        return;
    }

    // Безопасный сбор массива баз данных для веерной раздачи доступов
    let targetDbs = [];

    if (dbName === 'ALL') {
        // Собираем все доступные варианты из дата-листа баз
        const datalist = document.getElementById('globalDatabaseDatalist');
        if (datalist && datalist.options && datalist.options.length > 0) {
            targetDbs = Array.from(datalist.options)
                .map(opt => opt.value)
                .filter(val => val && val !== "" && val !== "ALL");
        }

        // Резервный ИБ-страховочный вариант: забираем кэш из глобального массива
        if (targetDbs.length === 0 && typeof window.currentServerDatabasesCache !== 'undefined') {
            targetDbs = window.currentServerDatabasesCache.filter(val => val !== "ALL");
        }

        if (targetDbs.length === 0) {
            alert('Не удалось собрать список баз для веерной раздачи ALL. Выберите конкретную базу.');
            return;
        }
    } else {
        // Если выбрана одна конкретная база — веер состоит из одного элемента
        targetDbs = [dbName];
    }

    // Инициализация переменных разметки для послойного разбора осей (ПРОДОЛЖЕНИЕ В ЧАСТИ 2)
    let action = "GRANT"; 
    let schemaName = "public"; 
    let tableName = "ALL"; 
    let privilegeValue = "";
    // -------------------------------------------------------------------------
    // 2. ПОУРОВНЕВЫЙ РАЗБОР ГЕОМЕТРИИ ФОРМ ИНТЕРФЕЙСА ФРОНТЕНДА
    // -------------------------------------------------------------------------
    
    // --- УРОВЕНЬ 1: DATABASE ---
    if (scope === 'DATABASE') {
        action = document.getElementById('dbAction')?.value || 'GRANT';
        privilegeValue = document.getElementById('dbPrivilege')?.value || '';
        schemaName = 'public';
        tableName = '';
    }
    // --- УРОВЕНЬ 2: SCHEMA ---
    else if (scope === 'SCHEMA') {
        action = document.getElementById('schemaAction')?.value || 'GRANT';
        
        // Поддержка веерного выбора ALL схем
        if (dbName === 'ALL') {
            schemaName = 'ALL';
        } else {
            const schemaSelect = document.getElementById('schemaTarget');
            if (schemaSelect && schemaSelect.selectedOptions && schemaSelect.selectedOptions.length > 0) {
                schemaName = Array.from(schemaSelect.selectedOptions).map(o => o.value).join(', ');
            }
        }

        const schemaPrivilege = document.getElementById('schemaPrivilege');
        if (schemaPrivilege && schemaPrivilege.selectedOptions) {
            privilegeValue = Array.from(schemaPrivilege.selectedOptions).map(o => o.value).join(', ');
        }
        tableName = '';
    }
    // --- УРОВЕНЬ 3: TABLE / DEFAULT_TABLE ---
    else if (scope === 'TABLE' || scope === 'DEFAULT_TABLE') {
        action = document.getElementById('tableAction')?.value || 'GRANT';
        
        // Если выбраны "Все базы", принудительно заставляем бэкенд перебирать все схемы
        schemaName = (dbName === 'ALL') ? 'ALL' : (document.getElementById('tableSchemaTarget')?.value || 'public');
        tableName = document.getElementById('tableNameTarget')?.value?.trim() || 'ALL';
        
        const tablePrivilege = document.getElementById('tablePrivilege');
        if (tablePrivilege && tablePrivilege.selectedOptions) {
            privilegeValue = Array.from(tablePrivilege.selectedOptions).map(o => o.value).join(', ');
        }
    }
    // --- УРОВЕНЬ 4: SEQUENCE / DEFAULT_SEQUENCE ---
    else if (scope === 'SEQUENCE' || scope === 'DEFAULT_SEQUENCE') {
        action = document.getElementById('seqAction')?.value || 'GRANT';
        
        // ИБ-ФИКС: Если выбраны "Все базы", принудительно отправляем бэкенду флаг ALL для веера схем
        schemaName = (dbName === 'ALL') ? 'ALL' : (document.getElementById('seqSchemaTarget')?.value || 'public');
        tableName = document.getElementById('seqNameTarget')?.value?.trim() || 'ALL';
        
        const seqPrivilege = document.getElementById('seqPrivilege');
        if (seqPrivilege && seqPrivilege.selectedOptions) {
            privilegeValue = Array.from(seqPrivilege.selectedOptions).map(o => o.value).join(', ');
        }
    }

    // ПЕРЕХОД К АСИНХРОННОМУ ЦИКЛУ ОТПРАВКИ (ПРОДОЛЖЕНИЕ В ЧАСТИ 3)
    // -------------------------------------------------------------------------
    // 3. АСИНХРОННЫЙ ВЕЕРНЫЙ ЦИКЛ ОБРАБОТКИ БАЗ ДАННЫХ ПО ОЧЕРЕДИ
    // -------------------------------------------------------------------------
    let successCount = 0;

    for (const currentDb of targetDbs) {
        const payload = {
            target_server: server,
            target_db: currentDb,    // Инжектируем конкретную базу на каждом шаге цикла веера
            username: role,
            scope: scope,
            schema_name: schemaName,
            table_name: tableName,
            action: action,
            privilege: privilegeValue
        };

        try {
            // Асинхронный fetch-пакет на бэкенд для атомарного применения прав
            const response = await secureFetch('/api/manage-privileges/', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                alert(`[ОТКАЗ СУБД] ${(data.detail || data.message || 'Ошибка изменения доступов')} на базе: ${currentDb}`);
                return; // Жестко прерываем трансляцию веера при ошибке ИБ-периметра
            }
            successCount++;
        } catch (error) {
            alert(`[СЕТЕВОЙ КРАХ] Ошибка связи при отправке пакета прав на базу ${currentDb}: ${error.message}`);
            return;
        }
    }

    // Итоговое сигнальное уведомление после завершения успешного прохода всего веера баз
    alert(`Успех! Права успешно применены. Обработано баз данных: ${successCount}`);
    
    // Автоматическое обновление логов журнала аудита на Вкладке №5
    if (typeof loadAuditLogs === 'function') {
        loadAuditLogs();
    }

    // // После отправки принудительно восстанавливаем скрытые вкладки,
    // // если сторонние скрипты (например, app.js) попытались затереть display: none
    const tabCreateUser = document.getElementById('securityCreateUserTabNavItem');
    const tabManageRights = document.getElementById('tabSecurityRights');
    const activeRole = localStorage.getItem('panel_user_role') || localStorage.getItem('role') || 'security_manager';

    if (activeRole.toLowerCase().includes('admin') || activeRole.toLowerCase().includes('manager') || activeRole.toLowerCase().includes('security')) {
        if (tabCreateUser) tabCreateUser.style.setProperty('display', 'block', 'important');
        if (tabManageRights) tabManageRights.style.setProperty('display', 'block', 'important');
    }

    // -------------------------------------------------------------------------
    // КРИТИЧЕСКИЙ ИБ-ФИКС: БЛОКИРУЕМ СБРОС СТРАНИЦЫ И ПЕРЕЗАГРУЗКУ UI БРАУЗЕРОМ
    // -------------------------------------------------------------------------
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault(); // Намертво запрещаем перезагрузку страницы браузером
    }
    
    // Если интерфейс использует хэш-навигацию (Tabs), принудительно удерживаем текущую вкладку
    const currentHash = window.location.hash;
    if (currentHash) {
        window.location.hash = '';
        window.location.hash = currentHash;
    }
}




export function toggleTableInputDisable() {
    const mode = document.getElementById('tableScopeMode').value;
    const nameInput = document.getElementById('tableNameTarget');
    if (mode === 'DEFAULT_TABLE') { nameInput.value = 'ALL'; nameInput.disabled = true; }
    else { nameInput.value = 'ALL'; nameInput.disabled = false; }
}
export function toggleSeqInputDisable() {
    const mode = document.getElementById('seqScopeMode').value;
    const nameInput = document.getElementById('seqNameTarget');
    if (mode === 'DEFAULT_SEQUENCE') { nameInput.value = 'ALL'; nameInput.disabled = true; }
    else { nameInput.value = 'ALL'; nameInput.disabled = false; }
}
export async function loadAuditLogs() {
    const tbody = document.getElementById('auditTable')?.querySelector('tbody');
    if (!tbody) return;

    // 1. БЕЗОПАСНЫЙ СБОР ДАННЫХ ИЗ ИНПУТОВ С ЗАЩИТОЙ ОТ NULL
    const auditUserEl = document.getElementById('auditFilterUser');
    const auditServerEl = document.getElementById('auditFilterServer');
    const auditActionEl = document.getElementById('auditFilterAction');
    const auditDateEl = document.getElementById('auditFilterDateFrom');

    const admin_user = auditUserEl ? auditUserEl.value.trim() : '';
    const s_id = auditServerEl ? auditServerEl.value.trim() : '';
    const act = auditActionEl ? auditActionEl.value.trim() : '';
    const date = auditDateEl ? auditDateEl.value : '';

    // 2. СТРОИМ ПАРАМЕТРЫ ЗАПРОСА К API БЭКЕНДА
    let queryParams = `page=${currentAuditPage}&size=20`;
    if (admin_user) queryParams += `&admin_username=${encodeURIComponent(admin_user)}`;
    if (s_id)        queryParams += `&target_server=${encodeURIComponent(s_id)}`;
    if (act)         queryParams += `&action=${encodeURIComponent(act)}`;
    if (date)        queryParams += `&timestamp=${encodeURIComponent(date)}`;

    try {
        const res = await secureFetch(`/api/audit/?${queryParams}`);
        const data = await res.json();
        tbody.innerHTML = '';

        const logsArray = data.logs || data.items || data;

        if (logsArray && logsArray.length > 0) {
            logsArray.forEach(l => {
                const statusClass = l.status === 'SUCCESS' || l.status === 'success' || l.status === 'status-success' ? 'status-success' : 'status-error';
                const errorDesc = l.error_message ? `<code class="text-danger">${l.error_message}</code>` : '<span class="text-muted">-</span>';

                // Жесткая синхронизация под структуру таблицы audit_logs
                const logId = l.log_id || l.id || '-';
                const adminName = l.admin_username || 'Система';
                const targetUser = l.usema || l.username || l.target_user || '-';
                const serverId = l.target_server || '-';
                const targetObject = l.table_name || '-';

                tbody.innerHTML += `
                    <tr>
                        <td style="padding: 10px !important;">${logId}</td>
                        <td style="padding: 10px !important;"><code style="white-space: nowrap !important;">${l.timestamp || l.created_at || '-'}</code></td>
                        <td style="padding: 10px !important;" class="fw-bold text-success">${adminName}</td>
                        <td style="padding: 10px !important;" class="fw-bold">${targetUser}</td>
                        <td style="padding: 10px !important;"><span class="badge bg-secondary">${serverId}</span></td>
                        <td style="padding: 10px !important;" class="fw-bold text-primary">${l.action || '-'}</td>
                        <td style="padding: 10px !important;"><code>${targetObject}</code></td>
                        <td style="padding: 10px !important;"><span class="text-dark fw-bold">${l.privilege || '-'}</span></td>
                        <td style="padding: 10px !important;" class="${statusClass}">${(l.status || '').toUpperCase()}</td>
                        <td style="padding: 10px !important; white-space: normal !important;">${errorDesc}</td>
                    </tr>
                `;
            });

            const totalItems = data.total || data.total_count || logsArray.length;
            const pageSize = data.size || 20;
            renderAuditPagination(totalItems, currentAuditPage, pageSize);
        } else {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted" style="padding: 20px !important;">Архив логов по запросу пуст</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger" style="padding: 20px !important;">Сбой соединения с базой аудита: ${err.message}</td></tr>`;
    }
}


export function resetAuditFilters() {
    if (document.getElementById('auditFilterUser')) document.getElementById('auditFilterUser').value = '';
    if (document.getElementById('auditFilterServer')) document.getElementById('auditFilterServer').value = '';
    if (document.getElementById('auditFilterAction')) document.getElementById('auditFilterAction').value = '';
    if (document.getElementById('auditFilterDateFrom')) document.getElementById('auditFilterDateFrom').value = '';
    currentAuditPage = 1;
    loadAuditLogs();
}
function renderAuditPagination(totalItems, currentAuditPage, pageSize) {
    const totalPages = Math.ceil(totalItems / pageSize);
    const container = document.getElementById('auditPagination');
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return; // // Если страниц меньше одной, переключатель не нужен
    
    let html = '';
    
    // // Кнопка Назад
    if (currentAuditPage > 1) {
        html += `<a href="#" style="padding: 6px 12px; border: 1px solid #dee2e6; text-decoration:none; border-radius:4px;" onclick="changeAuditPage(${currentAuditPage - 1}); return false;">« Назад</a>`;
    }
    
    // // Логика выбора номеров страниц (показываем текущую, пару до и пару после)
    let startPage = Math.max(1, currentAuditPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentAuditPage) {
            html += `<strong style="padding: 6px 12px; background:#e9ecef; border: 1px solid #ced4da; border-radius:4px; min-width:38px; text-align:center;">${i}</strong>`;
        } else {
            html += `<a href="#" style="padding: 6px 12px; border: 1px solid #dee2e6; text-decoration:none; border-radius:4px; min-width:38px; text-align:center;" onclick="changeAuditPage(${i}); return false;">${i}</a>`;
        }
    }
    
    // // Кнопка Вперед
    if (currentAuditPage < totalPages) {
        html += `<a href="#" style="padding: 6px 12px; border: 1px solid #dee2e6; text-decoration:none; border-radius:4px;" onclick="changeAuditPage(${currentAuditPage + 1}); return false;">Вперед »</a>`;
    }
    
    container.innerHTML = html;
}

export function changeAuditPage(pageNumber) {
    currentAuditPage = pageNumber;
    loadAuditLogs(); // // Перезагружаем порцию логов
}

if (typeof cachedModalRoles === 'undefined') {
    var cachedModalRoles = []; // Глобальный буфер-массив для мгновенного поиска ролей СУБД
}

export function openSystemRolesModal() {
    const srv = document.getElementById('globalTargetServer').value;
    const role = document.getElementById('globalRole').value;
    if (!srv || !role) { showAlert('Сначала укажите сервер и управляемую роль!', 'warning'); return; }
    
    document.getElementById('modalServerLabel').textContent = srv; 
    document.getElementById('modalUserLabel').textContent = role;
    
    // Мягкий ИБ-сброс текстового инпута фильтра при каждом новом открытии модалки
    const filterInput = document.getElementById('modalSysRolesFilter');
    if (filterInput) filterInput.value = '';
    
    const mSelect = document.getElementById('modalSysRolesSelect'); 
    if (mSelect) mSelect.innerHTML = '<option value="" disabled>Загрузка ролей...</option>';
    
    document.getElementById('systemRolesModal').style.display = 'flex';
    
    // Запрашиваем полный список ролей СУБД (включая кастомные и системные)
    Promise.all([
        secureFetch(`/api/get-target-roles/${srv}?show_system=false`).then(r => r.json()), // 1. Чисто кастомные роли
        secureFetch(`/api/get-target-roles/${srv}?show_system=true`).then(r => r.json())  // 2. Чисто системные роли pg_*
    ]).then(([customData, systemData]) => {
        const customList = customData.roles || [];
        const systemList = systemData.roles || [];
        
        // Побитово объединяем оба независимых массива в единый глобальный ИБ-реестр
        cachedModalRoles = [...customList, ...systemList];
        
        // Передаем склеенный гибридный пул в функцию динамического рендеринга
        renderModalRolesList(cachedModalRoles);
    }).catch(err => {
        console.error("Критический сбой каскадного слияния ролей:", err);
        if (mSelect) mSelect.innerHTML = '<option value="" disabled>Ошибка загрузки ролей СУБД</option>';
    });
}

function renderModalRolesList(rolesArray) {
    const mSelect = document.getElementById('modalSysRolesSelect');
    if (!mSelect) return;
    mSelect.innerHTML = '';
    
    if (rolesArray.length === 0) {
        mSelect.innerHTML = '<option value="" disabled>Совпадений не обнаружено</option>';
        return;
    }
    
    rolesArray.forEach(r => {
        mSelect.innerHTML += `<option value="${r}">${r}</option>`;
    });
}
export function filterCustomModalRoles() {
    const filterInput = document.getElementById('modalSysRolesFilter');
    if (!filterInput) return;
    
    const query = filterInput.value.toLowerCase().trim();
    // Фильтруем оригинальный кэш-массив по вхождению подстроки
    const filtered = cachedModalRoles.filter(roleName => roleName.toLowerCase().includes(query));
    renderModalRolesList(filtered);
}

export function closeSystemRolesModal() { 
    const modal = document.getElementById('systemRolesModal');
    if (modal) modal.style.display = 'none'; 
}
export async function submitSystemRoleModal(event) {
    if (event) event.preventDefault();
    const srv = document.getElementById('modalServerLabel').textContent;
    const role = document.getElementById('modalUserLabel').textContent;
    const action = document.getElementById('modalSysAction').value;
    const select = document.getElementById('modalSysRolesSelect');
    const selected = Array.from(select.selectedOptions).map(o => o.value).filter(v => v !== '');
    
    if (!selected.length) { alert('Укажите целевые группы ролей!'); return; }
    let success = 0; let errors = [];
    closeSystemRolesModal();
    
    for (const sysRole of selected) {
        try {
            const res = await secureFetch('/api/manage-system-roles', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ target_server: srv, username: role, system_role: sysRole, action: action }) 
            });
            if (res.ok) success++; 
            else { 
                const d = await res.json(); 
                errors.push(`${sysRole}: ${d.detail || 'Ошибка СУБД'}`); 
            }
        } catch { 
            errors.push(`${sysRole}: Ошибка связи`); 
        }
    }
    if (!errors.length) showAlert(`Системные и кастомные роли успешно изменены! Применено: ${success}`, 'success');
    else showAlert(`Применено: ${success}. Ошибок: ${errors.length}.<br>${errors.join('<br>')}`, 'danger');
}



export async function submitCreateUserAction(event) {
    if (event) event.preventDefault();

    const target_server = document.getElementById('createUserTargetServer')?.value.trim();
    const username = document.getElementById('createUserName')?.value.trim();
    const email = document.getElementById('createUserEmail')?.value.trim();

    if (!target_server || !username || !email) {
        alert('Заполните все три поля формы создания пользователя!');
        return;
    }

    try {
        const response = await secureFetch('/api/users/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_server: target_server,
                username: username,
                email: email
            })
        });

        const data = await response.json();
        if (response.ok) {
            alert(`Успех!\n\nПользователь "${username}" успешно создан на сервере ${target_server}.\nДанные отправлены на почту ${email}.`);
            if (document.getElementById('createUserName')) {
                document.getElementById('createUserName').value = '';
            }
        } else {
            alert('Ошибка бэкенда: ' + (data.detail || 'Не удалось создать роль'));
        }
    } catch (err) {
        alert('Ошибка сети: ' + err.message);
    }
}

export async function submitDeleteUserAction() {
    const target_server = document.getElementById('deleteUserTargetServer')?.value.trim();
    const username = document.getElementById('deleteUserSelect')?.value.trim();
    
    if (!target_server || !username) { alert('Заполните все поля для удаления роли!'); return; }
    if (!confirm(`КРИТИЧЕСКОЕ ДЕЙСТВИЕ!\n\nВы действительно хотите КАСКАДНО УДАЛИТЬ роль "${username}" с инстанса ${target_server}?`)) return;
    
    try {
        const response = await secureFetch('/api/users/', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_server, username })
        });
        const data = await response.json();
        if (response.ok) {
            alert(`Успешно!\n\nРоль "${username}" каскадно удалена со всеми зависимостями.`);
            if (document.getElementById('deleteUserSelect')) 
                document.getElementById('deleteUserSelect').value = '';
        } else { alert('Ошибка удаления: ' + (data.detail || 'Отказано бэкендом')); }
    } catch (err) { alert('Ошибка сети: ' + err.message); }
}


export async function submitLockUserAction() {
    const target_server = document.getElementById('lockUserTargetServer')?.value.trim();
    const username = document.getElementById('lockUserSelect')?.value.trim();
    const action = document.getElementById('lockUserAction')?.value;
    
    if (!target_server || !username || !action) { alert('Заполните все поля для изменения статуса!'); return; }
    
    try {
        const response = await secureFetch('/api/users/status/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_server, username, action })
        });
        const data = await response.json();
        if (response.ok) {
            alert(`Готово!\n\nОперация ${action} для пользователя "${username}" успешно выполнена!`);
        } else { alert('Ошибка изменения статуса: ' + (data.detail || 'Сбой СУБД')); }
    } catch (err) { alert('Ошибка сети: ' + err.message); }
}
