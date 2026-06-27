
🔒 ТЕХНИЧЕСКИЙ ПАСПОРТ И ИБ-АНАЛИЗ КОНТУРА КОНФИГУРАЦИИ (config.js)


Настоящий технический документ содержит детальное описание, профили безопасности 
и пошаговый структурный разбор системных перехватчиков сетевых HTTPS-транзакций.

--- Схема рантайм-валидации сетевых ответов и очистки сессий ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВЫЗОВ СЕТЕВОГО МЕТОДА: secureFetch(url, options)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Инъекция: options.headers['Authorization'] = `Bearer ${token}`</span></td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ИСПОЛНЕНИЕ ЗАПРОСА И ПЕРЕХВАТ ОТВЕТА СЕРВЕРА</div>
      <div style="font-size:0.85rem; color:#94a3b8;">Условие перехватчика затвора: if (response.status === 401)</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️ <span style="font-size:0.85rem; font-weight:bold; color:#475569;">Сверка состояния ОЗУ: const hasToken = localStorage.getItem('pg_access_token')</span></td>
  </tr>
  <tr>
    <td style="padding:15px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">
        <tr>
          <td style="width:49%; padding:12px; background-color:#ffeeeb; border:1px solid #ef4444; border-radius:4px; color:#991b1b; font-weight:bold;">
            КОНТУР А: Сессия протухла в процессе работы
          </td>
          <td style="width:2%; border:none;"></td>
          <td style="width:49%; padding:12px; background-color:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; color:#475569; font-weight:bold;">
            КОНТУР Б: Холодный старт без токена
          </td>
        </tr>
        <tr>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            ❌ Атомарное выжигание невалидных ключей из памяти браузера.<br>
            💾 removeItem('pg_access_token');<br>
            🔄 window.location.reload(); ──► Сброс в чистый экран входа.
          </td>
          <td></td>
          <td style="padding:10px; text-align:left; color:#334155; line-height:1.4; font-size:0.8rem;">
            🤫 Мягкое бесшумное переключение контейнеров вкладок.<br>
            👁️ loginContainer.classList.remove('d-none');<br>
            🙈 appContainer.classList.add('d-none');
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: RETURN RESPONSE ──► ПЕРЕДАЧА ОТВЕТА ВЫЗЫВАЮЩЕМУ МОДУЛЮ
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы secureFetch:
* **Защита от фиксации невалидных сессий (Session Hijacking)**: Перехватчик статуса `401` 
  надежно защищает систему от попыток операторов выполнять действия с протухшими, отозванными 
  или подмененными JWT-токенами. При обнаружении `401 Unauthorized` Контур А 
  немедленно выжигает из памяти `pg_access_token` и `panel_user_role`. Команда `reload()` 
  полностью сбрасывает ОЗУ вкладки браузера, гарантируя, что старый токен невозможно 
  извлечь и использовать повторно.
* **Предотвращение бесконечных циклов циклического редиректа**: Контур Б разделяет 
  ситуации, когда токен отсутствовал изначально (например, при первом открытии вкладки в браузере). 
  Вместо вызова деструктивной перезагрузки страницы, метод мягко переключает классы видимости 
  Bootstap (`d-none`), выводя форму входа без создания избыточной нагрузки на веб-сервер Nginx.

Централизованный фильтр вывода уведомлений, обеспечивающий принудительную санитизацию 
входящих текстовых сообщений и блокирующий проведение атак класса Cross-Site Scripting (XSS).

--- Схема очистки строковых примитивов от HTML-инжектов ---

<table style="width:100%; max-width:650px; border-collapse:collapse; font-family:sans-serif; margin:20px 0; box-shadow:0 2px 5px rgba(0,0,0,0.05); border-radius:6px; overflow:hidden;">
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1.1rem; letter-spacing:0.5px;">ВХОДНОЙ СТРОКОВЫЙ ПРИМИТИВ: showAlert(message)</td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️</td>
  </tr>
  <tr style="background-color:#1e293b; color:#ffffff; text-align:center;">
    <td style="padding:12px; border-bottom:1px solid #334155;">
      <div style="font-weight:bold; font-size:1rem; margin-bottom:4px;">ЭТАП А: ПРИНУДИТЕЛЬНАЯ РЕГУЛЯРНАЯ ЗАЧИСТКА ТЕГОВ (REGEXP)</div>
      <div style="font-size:0.85rem; color:#94a3b8;">message.replace(/&lt;[^&gt;]*&gt;/g, ' ').replace(/\s+/g, ' ').trim();</div>
    </td>
  </tr>
  <tr>
    <td style="text-align:center; padding:10px; color:#64748b; font-size:1.2rem;">⬇️</td>
  </tr>
  <tr style="background-color:#f8fafc; border:2px solid #e2e8f0; text-align:center;">
    <td style="padding:15px;">
      <strong>ЭТАП Б: ВЫЗОВ СТРОГОГО СИСТЕМНОГО ДИАЛОГОВОГО ОКНА БРАУЗЕРА</strong><br>
      <span style="font-size:0.85rem; color:#0f172a; font-weight:bold;">alert(cleanMessage);</span><br>
      <span style="font-size:0.8rem; color:#64748b;">Выполнение скриптов внутри нативного модального окна физически изолировано от DOM-дерева</span>
    </td>
  </tr>
  <tr style="background-color:#0f172a; color:#ffffff; text-align:center; font-weight:bold;">
    <td style="padding:15px; font-size:1rem; letter-spacing:0.5px; background:linear-gradient(to right, #1e293b, #0f172a);">
      ФИНАЛ: ВЫВОД И СТИРАНИЕ ВРЕМЕННОГО СТРОКОВОГО БУФЕРА
    </td>
  </tr>
</table>

### 🛡️ Профиль ИБ-защиты подсистемы санитизации:
* **Тотальное вырезание вредоносных HTML-тегов (XSS Clean)**: На строке 46 внедрен жесткий 
  регулярный ИБ-фильтр `message.replace(/<[^>]*>/g, ' ')`. Любые попытки передать 
  скрытый деструктивный JS-код со стороны бэкенда или перехваченных ответов СУБД на корню 
  аннигилируются. Конвертер превращает теги в безопасные пробельные символы, вырезая 
  вредоносную нагрузку из рантайма страницы.
* **Изоляция контекста выполнения (Песочница Alert)**: Вывод очищенных уведомлений 
  принудительно замкнут на нативную системную функцию браузера `alert(cleanMessage)`. 
  Нативные окна оперируют чистыми строковыми примитивами и не выполняют HTML-парсинг innerHTML, 
  что полностью изолирует их от DOM-дерева. Даже если тег будет деформирован, браузер 
  отобразит его как плоский текст, исключая уязвимости Stored/Reflected XSS.
* **Нормализация пробельных символов (DoS-String Protection)**: Каскадное сжатие 
  множественных пробелов и символов табуляции `replace(/\s+/g, ' ')` страхует буфер рендеринга 
  модального окна от попыток сдвинуть границы интерфейса гигантскими массивами пустых строк.


