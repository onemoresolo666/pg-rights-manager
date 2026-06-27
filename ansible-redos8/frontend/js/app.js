// =========================================================================
// ГЛАВНЫЙ СИНХРОННЫЙ МОДУЛЬ РАСПРЕДЕЛЕНИЯ ПАКЕТОВ JS
// =========================================================================
import { secureFetch, showAlert } from './config.js';
import { submitLoginForm, logoutSession } from './auth.js';
import { 
    submitForm, onServerChanged, onDatabaseChanged, 
    onTableSchemaChanged, toggleTableInputDisable, toggleSeqInputDisable, 
    loadAuditLogs, resetAuditFilters, openSystemRolesModal, 
    closeSystemRolesModal, filterCustomModalRoles, submitSystemRoleModal, 
    submitDeleteUserAction, submitLockUserAction, submitCreateUserAction, 
    changeAuditPage 
} from './rights.js';
import { 
    loadServersRegistry, loadServersForSelect, changeServersPage, 
    filterServersTable, testRowConnection, testConnectionBeforeRegister, 
    submitRegisterServerForm, inlineDeleteServer, onDeleteServerChanged, 
    onLockServerChanged, inlineTestServerConnection, deleteServer 
} from './servers.js';
import { 
    loadPanelUsers, changePanelUsersPage, submitRegisterPanelUserForm, 
    inlineDeletePanelUser, inlineChangePassword, inlineToggleStatus, editPanelUser, submitDirectIbLimitsUpdate 
} from './panel_users.js';
import { submitSmtpConfigForm, submitSmtpTestForm } from './smtp.js';
import { 
    securityOnServerChanged, securityOnDatabaseChanged, 
    securityOnUserSelected, securityLoadServersForSelect, secSubmitCustomRoleAssign, securitySubmitOnlyCreateUser
} from './security_rights.js';

// Проброс в глобальное окно window для работы инлайновых onclick/onsubmit в HTML
window.secureFetch = secureFetch;
window.showAlert = showAlert;
window.submitLoginForm = submitLoginForm;
window.logoutSession = logoutSession;
window.submitForm = submitForm;
window.onServerChanged = onServerChanged;
window.onDatabaseChanged = onDatabaseChanged;
window.onTableSchemaChanged = onTableSchemaChanged;
window.toggleTableInputDisable = toggleTableInputDisable;
window.toggleSeqInputDisable = toggleSeqInputDisable;
window.loadAuditLogs = loadAuditLogs;
window.resetAuditFilters = resetAuditFilters;
window.openSystemRolesModal = openSystemRolesModal;
window.closeSystemRolesModal = closeSystemRolesModal;
window.filterCustomModalRoles = filterCustomModalRoles;
window.submitSystemRoleModal = submitSystemRoleModal;
window.loadServersRegistry = loadServersRegistry;
window.loadServersForSelect = loadServersForSelect;
window.changeServersPage = changeServersPage;
window.filterServersTable = filterServersTable;
window.testRowConnection = testRowConnection;
window.testConnectionBeforeRegister = testConnectionBeforeRegister;
window.submitRegisterServerForm = submitRegisterServerForm;
window.inlineDeleteServer = inlineDeleteServer;
window.onDeleteServerChanged = onDeleteServerChanged;
window.onLockServerChanged = onLockServerChanged;
window.inlineTestServerConnection = inlineTestServerConnection;
window.editPanelUser = editPanelUser;
window.loadPanelUsers = loadPanelUsers;
window.changePanelUsersPage = changePanelUsersPage;
window.submitRegisterPanelUserForm = submitRegisterPanelUserForm;
window.inlineDeletePanelUser = inlineDeletePanelUser;
window.inlineChangePassword = inlineChangePassword;
window.inlineToggleStatus = inlineToggleStatus;
window.submitSmtpConfigForm = submitSmtpConfigForm;
window.submitSmtpTestForm = submitSmtpTestForm;
window.submitDeleteUserAction = submitDeleteUserAction;
window.submitLockUserAction = submitLockUserAction;
window.submitCreateUserAction = submitCreateUserAction;
window.deleteServer = deleteServer;
window.changeAuditPage = changeAuditPage;
window.securityOnServerChanged = securityOnServerChanged;
window.securityOnDatabaseChanged = securityOnDatabaseChanged;
window.securityOnUserSelected = securityOnUserSelected;
window.secSubmitCustomRoleAssign = secSubmitCustomRoleAssign;
window.securityLoadServersForSelect = securityLoadServersForSelect;
window.securitySubmitOnlyCreateUser = securitySubmitOnlyCreateUser;
window.submitDirectIbLimitsUpdate = submitDirectIbLimitsUpdate;
 


// =========================================================================
// СТАРТОВЫЙ ЗАПУСК ИНИЦИАЛИЗАЦИИ И НАВИГАЦИИ ПАНЕЛИ
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('pg_access_token') || localStorage.getItem('token');
    
    const savedRole = localStorage.getItem('panel_user_role') || 
                      localStorage.getItem('user_role') || 
                      localStorage.getItem('role') || 
                      'admin';
                      
    console.log(`[ХОЛОДНЫЙ СТАРТ] Токен сессии: ${token ? "ПРИСУТСТВУЕТ" : "ОТСУТСТВУЕТ"}. Загруженная роль: "${savedRole}"`);
    
    if (token) {
        // 🟩 [ИБ-НАДЗИРАТЕЛЬ]: СНАЙПЕРСКИЙ ПРИНУДИТЕЛЬНЫЙ ВЫЗОВ ОБНОВЛЕНИЯ ПРОФИЛЯ ДЛЯ ВСЕХ РОЛЕЙ ПАНЕЛИ
        // Даем Хрому долю миллисекунды связать файлы и мгновенно раскрашиваем бейдж в шапке
        if (typeof window.renderActiveUserProfileBadge === 'function') {
            window.renderActiveUserProfileBadge();
        }

        const loginContainer = document.getElementById('loginContainer');
        const appContainer = document.getElementById('appContainer');
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';

        // -------------------------------------------------------------------------
        // Разделение функций стартовой подгрузки серверов по кастам
        // -------------------------------------------------------------------------
        if (savedRole === 'Security_Manager') {
            if (typeof window.securityLoadServersForSelect === 'function') {
                window.securityLoadServersForSelect();
            }
        } else {
            if (typeof window.loadServersForSelect === 'function') {
                window.loadServersForSelect();
            }
        }
        
        const delInput = document.getElementById('deleteUserTargetServer');
        const lockInput = document.getElementById('lockUserTargetServer');

        if (delInput && typeof window.onDeleteServerChanged === 'function') {
            delInput.addEventListener('input', window.onDeleteServerChanged);
        }
        if (lockInput && typeof window.onLockServerChanged === 'function') {
            lockInput.addEventListener('input', window.onLockServerChanged);
        }

        const tabButtons = document.querySelectorAll('#mainTabs .nav-link, #mainTabs button');

        // Принудительно применяем ролевой фильтр доступа
        if (typeof window.applyRoleBasedAccess === 'function') {
            window.applyRoleBasedAccess(savedRole);
        }

    if (savedRole === 'auditor') {
        // 🟩 [ИБ-НАДЗИРАТЕЛЬ]: Обновляем паспорт для Аудитора
        if (typeof window.renderActiveUserProfileBadge === 'function') window.renderActiveUserProfileBadge();

        const auditPane = document.getElementById('auditTab') || document.getElementById('panelAuditTab');
        if (auditPane) {
            document.querySelectorAll('.tab-content .tab-pane').forEach(p => p.classList.remove('active', 'show'));
            auditPane.classList.add('active', 'show');
            auditPane.style.setProperty('display', 'block', 'important');
        }
  } else if (savedRole === 'Security_Manager') {
    // [ИБ-НАДЗИРАТЕЛЬ]: Обновляем паспорт для ИБ-Офицера
    if (typeof window.renderActiveUserProfileBadge === 'function') 
        window.renderActiveUserProfileBadge();
    
    // РОЛЬ принудительно сажается на Вкладку №1 (Создать пользователя ИБ)
    const secCreatePane = document.getElementById('securityCreateUserTab');
    if (secCreatePane) {
        document.querySelectorAll('.tab-content .tab-pane').forEach(p => p.classList.remove('active', 'show'));
        secCreatePane.classList.add('active', 'show');
        secCreatePane.style.setProperty('display', 'block', 'important');
    }
  } else {
        // 🟩 [ИБ-НАДЗИРАТЕЛЬ]: Обновляем паспорт для Суперадминистратора (admin)
        if (typeof window.renderActiveUserProfileBadge === 'function') window.renderActiveUserProfileBadge();

        document.querySelectorAll('.tab-content .tab-pane').forEach((pane, idx) => {
            if (idx === 0) {
                pane.classList.add('active', 'show');
                pane.style.setProperty('display', 'block', 'important');
            } else {
                pane.classList.remove('active', 'show');
                pane.style.setProperty('display', 'none', 'important');
            }
        });
    }

        // Перехватчик и валидатор кликов по вкладкам меню
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const roleCache = localStorage.getItem('panel_user_role') || 
                                  localStorage.getItem('user_role') || 
                                  localStorage.getItem('role') || 
                                  'admin';
                const targetSelector = button.getAttribute('data-bs-target') || button.getAttribute('href');

                if (roleCache === 'auditor' && targetSelector !== '#auditTab' && targetSelector !== '#panelAuditTab') {
                    return false;
                }
                
                if (roleCache === 'Security_Manager' && (targetSelector === '#panelUsersTab' || targetSelector === '#panelAdminsTab' || targetSelector === '#panelSmtpTab')) {
                    return false;
                }

                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                const targetPane = document.querySelector(targetSelector);
                if (targetPane) {
                    document.querySelectorAll('.tab-content .tab-pane').forEach(pane => {
                        pane.classList.remove('active', 'show');
                        pane.style.setProperty('display', 'none', 'important');
                    });
                    targetPane.classList.add('active', 'show');
                    targetPane.style.setProperty('display', 'block', 'important');
                }
            });
        });

    } else {
        const loginContainer = document.getElementById('loginContainer');
        const appContainer = document.getElementById('appContainer');
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }
});


// =========================================================================
// ИБ-КОНТУР УПРАВЛЕНИЯ ДОСТУПОМ
// =========================================================================
export function applyRoleBasedAccess(role) {
    const mainTabs = document.getElementById('mainTabs');
    const tabButtons = document.querySelectorAll('.nav-tabs .nav-link, .nav-tabs button, #mainTabs .nav-link, #mainTabs button');
    const serverInputEl = document.getElementById('globalTargetServer') || document.getElementById('secTargetServer');
    const databaseInputEl = document.getElementById('globalDatabase') || document.getElementById('secDatabase');

    if (!tabButtons || tabButtons.length === 0) {
        console.error("🚨 [ИБ ОШИБКА] Навигационные кнопки вкладок не найдены в DOM-дереве страницы!");
        return;
    }

    const currentRole = role ||
        localStorage.getItem('panel_user_role') ||
        localStorage.getItem('user_role') ||
        localStorage.getItem('role') ||
        'admin';

    console.log(`[ИБ НАДЗИРАТЕЛЬ] Запуск маскирования вкладок для роли: "${currentRole}". Всего кнопок в меню: ${tabButtons.length}`);

    const localTabSecBtn = document.getElementById('tabSecurityRights');

    // -------------------------------------------------------------------------
    // КОНТУР №1: РОЛЬ АУДИТОР ИБ (auditor)
    // -------------------------------------------------------------------------
    if (currentRole === 'auditor') {
        console.log("[ИБ НАДЗИРАТЕЛЬ] Активация ReadOnly-контура логов для ... ");
        tabButtons.forEach((btn, idx) => {
            const target = btn.getAttribute('data-bs-target') || btn.getAttribute('href') || '';
            if (idx === 5 || target === '#auditTab' || target === '#panelAuditTab') {
                btn.style.setProperty('display', 'block', 'important');
                btn.classList.add('active');
                try {
                    const tabInstance = bootstrap.Tab.getOrCreateInstance(btn);
                    tabInstance.show();
                } catch(e) { if (typeof btn.click === 'function') btn.click(); }
            } else {
                btn.style.setProperty('display', 'none', 'important');
            }
        });

        const actionButtons = document.querySelectorAll('button[type="submit"], .btn-primary, .btn-danger, .btn-table-action');
        actionButtons.forEach(btn => {
            btn.setAttribute('disabled', 'true');
            btn.style.opacity = '0.3';
            btn.style.cursor = 'not-allowed';
        });

        if (typeof loadAuditLogs === 'function') loadAuditLogs();
        return;
    }

    // -------------------------------------------------------------------------
    // КОНТУР №2: ИБ-ОФИЦЕР (Security_Manager)
    // -------------------------------------------------------------------------
    if (currentRole === 'Security_Manager') {
        console.log("[ИБ НАДЗИРАТЕЛЬ] Вход под ИБ-Офицером. Полная зачистка всех админских вкладок из DOM периметра.");

        // А. [МАСКИРОВАНИЕ ВЕРХНЕГО МЕНЮ]: Разрешаем показ только ИБ-вкладок
        tabButtons.forEach(btn => {
            const btnText = String(btn.innerText || btn.textContent || '').trim();
            const targetPaneId = btn.getAttribute('data-bs-target') || btn.getAttribute('href') || '';

            if (
                btnText.includes('ИБ') ||
                targetPaneId === '#rights' ||
                targetPaneId === '#securityCreateUserTab' ||
                targetPaneId === '#panelSecurityRightsTab' || 
                btn.id === 'tabSecurityRightsIb' ||
                btn.id === 'tabSecurityRights' ||            
                btn.id === 'tabSecurityRights-btn' ||        
                btn.id === 'securityCreateUser-tab' ||
                btn.id === 'securityCreateUserTabNavItem'
            ) {
                btn.style.setProperty('display', 'block', 'important');
            } else {
                btn.style.setProperty('display', 'none', 'important');
                btn.classList.remove('active');
            }
        });

        // ПРОДОЛЖЕНИЕ И СИНТАКСИЧЕСКОЕ ЗАКРЫТИЕ ФУНКЦИИ В ЧАСТИ 2
        // Б. [ЛИКВИДАТОР АДМИНСКИХ ФОРМ ВНУТРИ КОНТЕЙНЕРА]
        const rightsContainer = document.getElementById('rights') || document.querySelector('.tab-content');
        if (rightsContainer) {
            rightsContainer.style.setProperty('display', 'block', 'important');

            // Находим вообще ВСЕ вложенные карточки, формы, таблицы, разделители и заголовки h5
            const allInnerBlocks = rightsContainer.querySelectorAll('.card, h5, form, hr, .dashed-line, h2, h3, h4, div');
            allInnerBlocks.forEach(block => {

                // Белый список элементов, которые ЗАПРЕЩЕНО скрывать
                const isOurNewFormCard = block.id === 'securityCreateUserTab' || block.closest('#securityCreateUserTab') !== null;
                const isOurIbPanelCard = block.innerText.includes('Делегирование системных групп') || 
                                         block.closest('#secInlinePanel') || 
                                         block.id === 'secInlinePanel' ||
                                         block.id === 'panelSecurityRightsTab' || 
                                         block.closest('#panelSecurityRightsTab') !== null;

                if (!isOurIbPanelCard && !isOurNewFormCard) {
                    // Намертво гасим только чужой админский контент (DATABASE, SCHEMA, TABLE)
                    block.style.setProperty('display', 'none', 'important');
                    block.style.setProperty('visibility', 'hidden', 'important');
                    block.style.setProperty('opacity', '0', 'important');
                    block.style.setProperty('height', '0', 'important');
                    block.style.setProperty('margin', '0', 'important');
                    block.style.setProperty('padding', '0', 'important');
                }
            });
        }

        // В. ВКЛЮЧАЕМ И ПОДСВЕЧИВАЕМ НАШИ ИБ-ЭКРАНЫ
        const newCreateUserTabItem = document.getElementById('securityCreateUserTabNavItem');
        if (newCreateUserTabItem) {
            newCreateUserTabItem.style.setProperty('display', 'block', 'important');
        }

        if (localTabSecBtn) {
            localTabSecBtn.style.setProperty('display', 'block', 'important');
            localTabSecBtn.classList.add('active');
        }

        // Нативно активируем и выравниваем слой Bootstrap 5
        try {
            if (localTabSecBtn) {
                const tabInstance = bootstrap.Tab.getOrCreateInstance(localTabSecBtn);
                tabInstance.show();
            }
        } catch (e) {
            if (localTabSecBtn && typeof localTabSecBtn.click === 'function') localTabSecBtn.click();
        }

        // Г. Восстанавливаем кнопки и переключаем триггеры ввода на изолированный security_rights.js
        const actionButtons = document.querySelectorAll('button[type="submit"], .btn-primary, .btn-danger, .btn-table-action');
        actionButtons.forEach(btn => {
            if (btn.id === 'secInlineSubmitBtn') {
                btn.removeAttribute('disabled');
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });

        if (serverInputEl) serverInputEl.setAttribute('oninput', 'window.securityOnServerChanged()');
        if (databaseInputEl) databaseInputEl.setAttribute('oninput', 'window.securityOnDatabaseChanged()');

        // Запускаем наполнение селектора серверов ИБ напрямую из нашего модуля
        if (typeof window.securityLoadServersForSelect === 'function') {
            window.securityLoadServersForSelect();
        }

        // Д. [ОЗУ-ВЫЖИГАТЕЛЬ КАСТОМНЫХ КНОПОК ШАПКИ СТРАНИЦЫ]
        const allButtonsOnPage = document.querySelectorAll('button, .btn, .nav-link, a');
        allButtonsOnPage.forEach(el => {
            const text = String(el.innerText || el.textContent || '').trim();

            if (text === 'Управление правами' || text === 'Управление привилегиями') {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('opacity', '0', 'important');
                el.style.setProperty('width', '0', 'important');
                el.style.setProperty('height', '0', 'important');
                el.style.setProperty('margin', '0', 'important');
                el.style.setProperty('padding', '0', 'important');
            }
        });
        return;
    }

    // -------------------------------------------------------------------------
    // КОНТУР №3: ПОЛНЫЙ СУПЕР-АДМИНИСТРАТОР (admin) — ПОЛНЫЙ БЕЗЛИМИТ ПАНЕЛИ
    // -------------------------------------------------------------------------
    console.log("[ИБ НАДЗИРАТЕЛЬ] Вход под Администратором. Возврат к дефолтной безлимитной конфигурации.");

    tabButtons.forEach(btn => {
        const btnText = String(btn.innerText || btn.textContent || '').trim();

        if (
            btn.id === 'tabSecurityRights' || 
            btn.id === 'tabSecurityRights-btn' || 
            btn.id === 'securityCreateUserTabNavItem' ||
            btnText.includes('(ИБ)') || 
            btnText === 'Управление правами' && btn.style.backgroundColor === '#fef3c7'
        ) {
            btn.style.setProperty('display', 'none', 'important');
            btn.classList.remove('active');
        } else {
            // Все остальные стандартные админские вкладки открываем
            btn.style.setProperty('display', 'block', 'important');
        }
    });

    const actionButtons = document.querySelectorAll('button[type="submit"], .btn-primary, .btn-danger, .btn-table-action');
    actionButtons.forEach(btn => {
        btn.removeAttribute('disabled');
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });

    const adminServerInput = document.getElementById('globalTargetServer');
    const adminDatabaseInput = document.getElementById('globalDatabase');

    if (adminServerInput) adminServerInput.setAttribute('oninput', 'window.onServerChanged()');
    if (adminDatabaseInput) adminDatabaseInput.setAttribute('oninput', 'window.onDatabaseChanged()');
}


// Принудительно запечатываем мост в глобальный объект window для инлайновых вызовов в HTML вёрстке
window.applyRoleBasedAccess = applyRoleBasedAccess;

// =========================================================================
// ДИНАМИЧЕСКИЙ КОНТРОЛЬ ДОСТУПА К ВКЛАДКЕ СОЗДАНИЯ УЗ ПО РОЛИ
// =========================================================================
export function applyRoleBasedUiAccessControl() {
    const createTabNavItem = document.getElementById('securityCreateUserTabNavItem');
    const createTabContent = document.getElementById('securityCreateUserTab');
    
    if (!createTabNavItem) return;

    try {
        // 1. Нативно извлекаем роль текущей активной сессии оператора из ОЗУ и JWT-токена
        let currentSessionRole = localStorage.getItem('panel_user_role') || localStorage.getItem('role') || '';
        
        const sessionToken = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
        if (sessionToken && sessionToken.includes('.')) {
            try {
                const base64Url = sessionToken.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const tokenData = JSON.parse(atob(base64));
                // Забираем честную роль из полезной нагрузки токена
                if (tokenData.role) currentSessionRole = tokenData.role;
            } catch (e) { console.warn("[ИБ НАДЗИРАТЕЛЬ] Ошибка парсинга роли из JWT:", e); }
        }

        const cleanRole = String(currentSessionRole).trim().toLowerCase();
        console.log(`[ИБ НАДЗИРАТЕЛЬ UI] Инициализация прав экрана. Текущая роль в рантайме: "${cleanRole}"`);

        // =========================================================================
        // ЖЕСТКИЙ ЗАТВОР ДОСТУПА: Вкладка видна СТРОГО для Security_Manager
        // =========================================================================
        if (cleanRole === 'security_manager' || cleanRole === 'securitymanager') {
            // Если вошел ИБ-офицер — срываем замок скрытия и плавно выводим вкладку на экран
            createTabNavItem.style.setProperty('display', 'block', 'important');
            console.log("🟢 [ИБ НАДЗИРАТЕЛЬ UI] Доступ разрешен: Вкладка создания УЗ активирована для роли Security_Manager.");
        } else {
            // Для суперадминов (admin) и любых других ролей — наглухо вырезаем вкладку из DOM-дерева
            createTabNavItem.remove(); 
            if (createTabContent) createTabContent.remove();
            console.log("🔒 [ИБ НАДЗИРАТЕЛЬ UI] Доступ заблокирован: Вкладка создания УЗ полностью аннигилирована из интерфейса для текущей роли.");
        }
    } catch (err) {
        console.error("🚨 Критический сбой ИБ-контроллера видимости интерфейса:", err);
    }
}

// =========================================================================
// АВТО-ИНИЦИАЛИЗАЦИЯ
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Даем микро-задержку в 200мс для гарантированной прогрузки токенов в RAM
    setTimeout(() => {
        console.log("🚀 [ИБ НАДЗИРАТЕЛЬ UI] Нативный безаварийный старт контроля доступа...");
        if (typeof applyRoleBasedUiAccessControl === 'function') {
            applyRoleBasedUiAccessControl();
        }
    }, 200);
});


// Пробрасываем мост на шину window для сквозного вызова при ре-логине без перезагрузки страницы
window.applyRoleBasedUiAccessControl = applyRoleBasedUiAccessControl;
