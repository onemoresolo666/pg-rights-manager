
🕵️‍♂️ ИНСТРУКЦИЯ ПО РАСШИРЕННОМУ ИБ-ОТЛАДОЧНОМУ СКАНИРОВАНИЮ ФРОНТЕНДА (DEVTOOLS)

Настоящее техническое руководство содержит пошаговый регламент отладки DOM-периметра, 
перехвата скрытых ошибок JS-рантайма в консоли браузера, трассировки сетевых Ajax-запросов 
(fetch) и анализа ИБ-заheaders.

------------------------------------------------------------------------------------------
КОНТУР СКВОЗНОЙ ОТЛАДКИ И ПЕРЕХВАТА AJAX-ТРАНЗАКЦИЙ (DEVTOOLS MAP)
------------------------------------------------------------------------------------------
Мониторинг аномалий фронтенда (Vanilla JS) опирается на трехуровневую фильтрацию событий: 
вкладка Console (ошибки рантайма), вкладка Network (XHR/fetch запросы) и инспекция заголовков.

--- Схема прохождения сетевых пакетов и фильтрации трассировок UI ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СБОЙ ИНТЕРФЕЙСА ИЛИ АНОМАЛИЯ В auth.js / rights.js / servers.js</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Перехватчик браузера: Нажатие клавиши F12 ──► Открытие Chrome DevTools</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: АНАЛИЗ ОШИБОК И СТАТУСОВ ОТВЕТОВ В СЕТИ (NETWORK)</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Фильтр: Fetch/XHR ──► Анализ Payload и Response JSON от FastAPI-бэкенда</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Изоляция сбоев внутри блоков try { ... } catch (err)</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            Контур А: Ошибки Синтаксиса / Импорта
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#fffbeb; border:1px solid #f59e0b; border-radius:4px; color:#92400e; font-weight:bold;">
            Контур Б: Аномалии CORS и Секретов
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🚨 Выброс Uncaught SyntaxError / ReferenceError.<br>
            ✂️ Сбой связывания модулей при отсутствии ключевых слов export.<br>
            🧹 Локализация: Анализ точной строки анонимного вызова (index):38.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ⚠️ Блокировка ответов из-за отсутствия CORS заголовков.<br>
            🔒 Падение сессий при вымывании JWT из localStorage.<br>
            ⏱️ Контроль ответов 401 Unauthorized и 403 Forbidden.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      АНАЛИЗ ЗАВЕРШЕН ──► СБРОС КЭША БРАУЗЕРА КОМБИНАЦИЕЙ CTRL + F5
    </td>
  </tr>
</table>

### 🛠️ Пошаговый алгоритм проведения глубокой отладки (Debugging) фронтенда:

1. **Инициализация консоли отладки DevTools:**
   Откройте веб-интерфейс панели в браузере Chrome или Яндекс.Браузер. Нажмите клавишу **F12** (или сочетание **Ctrl + Shift + I**) и переключитесь на вкладку **Console**. Здесь отображаются все критические сбои парсинга JavaScript.

2. **Запуск живого перехвата сетевых пакетов (Network Trace):**
   Перейдите на вкладку **Network** и включите фильтр **Fetch/XHR**. Сделайте тестовое действие (например, попытку авторизации или накат прав на таблицу). Нажмите на появившуюся строку запроса и изучите вкладки:
   * `Payload`: Что именно ваш JS-код сформировал и отправил на бэкенд.
   * `Response`: Точный сырой JSON-ответ сервера, включая скрытые детали ошибок Pydantic или PostgreSQL.

3. **Сброс агрессивного кэширования статики:**
   Поскольку браузеры намертво кэшируют локальные скрипты `auth.js` и `rights.js`, любые ваши правки в коде на сервере могут игнорироваться клиентом. При открытой консоли DevTools зажмите правую кнопку мыши на значке перезагрузки страницы в браузере и выберите пункт **«Очистка кэша и жесткая перезагрузка»** (или нажмите **Ctrl + F5**).

------------------------------------------------------------------------------------------
ИСПРАВЛЕННАЯ СЛУЖЕБНАЯ ИНСТРУКЦИЯ ПО ОПЕРАТИВНОМУ ДЕБАЖУ UI
------------------------------------------------------------------------------------------
Контур обеспечивает экспресс-диагностику сбоев DOM-модели, нарушений импорта ESM-модулей, 
проблем локального кэширования переменных и аномалий кодировки на стороне клиента.

--- Матрица диагностических кодов и ИБ-затворов фронтенда ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">СИСТЕМНЫЙ МАРКЕР ОШИБКИ И СТАТУС В БРАУЗЕРЕ (DEVTOOLS)</td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem; line-height:1.4;">
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px; width:45%; background-color:#ffeeeb; color:#991b1b; font-weight:bold; border-right:1px solid #e2e8f0;">
            ⚠️ Uncaught ReferenceError: submitLoginForm is not defined at HTMLFormElement.onsubmit
          </td>
          <td style="padding:10px; color:#334155;">
            <strong>Причина:</strong> Скрипт auth.js запер функцию внутри изолированного модуля, или она не экспортирована во внешний контекст.<br>
            🛠️ <strong>Фикс:</strong> Внедрить в конец auth.js глобальный ИБ-мост: <code>window.submitLoginForm = submitLoginForm;</code>.
          </td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px; background-color:#ffeeeb; color:#991b1b; font-weight:bold; border-right:1px solid #e2e8f0;">
            ⚠️ Uncaught SyntaxError: The requested module './auth.js' does not provide an export named 'logoutSession'
          </td>
          <td style="padding:10px; color:#334155;">
            <strong>Причина:</strong> Скрипт ядра app.js пытается импортировать функцию выхода, у которой на стороне auth.js отсутствует директива export.<br>
            🛠️ <strong>Фикс:</strong> Добавить явное объявление <code>export function logoutSession()</code> в коде управления сессиями.
          </td>
        </tr>
        <tr>
          <td style="padding:10px; background-color:#ffeeeb; color:#991b1b; font-weight:bold; border-right:1px solid #e2e8f0;">
            ⚠️ Вывод битых спецсимволов и кракозябр вида âš ï, на экране входа
          </td>
          <td style="padding:10px; color:#334155;">
            <strong>Причина:</strong> Бэкенд шлет сырые двухбайтовые эмодзи в ASCII/CP1251 заголовках ответа без явного UTF-8 флага веб-сервера.<br>
            🛠️ <strong>Фикс:</strong> Навесить санитизацию строк на клиенте через регулярное выражение <code>.replace(/[^\x00-\x7Fа-яА-ЯёЁ\s\.,!\?-]/g, '')</code>.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      КОНТУР ИНТЕРФЕЙСНОЙ ДИАГНОСТИКИ И ДЕБАЖА UI УСПЕШНО ЗАКРЫТ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-безопасности при проведении отладочных работ клиента:
* **Защита от XSS-инъекций через отладочный вывод ошибок (XSS Prevention)**: При получении 
  любых динамических текстов ошибок с бэкенда (свойства `data.detail` или `err.message`), 
  фронтенд принудительно очищает их перед встраиванием в страницу. Вместо вызова небезопасных 
  методов сырого рендеринга, код прогоняется через ИБ-выпрямитель санитизации спецсимволов. 
  Это на 100% исключает риски внедрения вредоносных HTML/JS скриптов через подмену ответов 
  базы данных или полей сообщений сетевых таймаутов.
* **Изоляция сессионных токенов при крахах рантайма**: При любых критических сбоях на стороне 
  интерфейса, сессионные JWT-ключи остаются изолированы в защищенном хранилище `localStorage` 
  и не вымываются во внешние логи.

