import os
import logging
from utils import get_current_user, RoleChecker
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


# Настройка системного логгера для трассировки ИБ-операций
logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/smtp", tags=["SMTP"])

# Твердый абсолютный путь к вашему ИБ-файлу окружения проекта
ENV_FILE_PATH = "/opt/pgrights_manager/.env"

# 1. Pydantic-модели для жесткой валидации входящих пакетов фронтенда
class SmtpConfigSchema(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    use_tls: bool = True

class TestEmailSchema(BaseModel):
    recipient: EmailStr

# 2. Асинхронная вспомогательная функция для атомарной записи параметров в .env
def write_config_to_env(config: SmtpConfigSchema):
    """Хирургически точно обновляет или дописывает ключи SMTP внутри .env файла"""
    logger.info("[ИБ-АУДИТ] >>> Запрос на динамическое изменение конфигурации SMTP шлюза...")

    ENV_FILE_PATH = "/opt/pgrights_manager/.env"
    lines = []

    try:
        if os.path.exists(ENV_FILE_PATH):
            with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()

        # ИБ-ФИКС: Всеядный разбор схемы pydantic. Извлекаем данные через model_dump() / dict() или get()
        if hasattr(config, "model_dump"):
            cfg_data = config.model_dump()
        elif hasattr(config, "dict"):
            cfg_data = config.dict()
        elif isinstance(config, dict):
            cfg_data = config
        else:
            cfg_data = vars(config)

        # Переводим схему в словарь строк для записи в текстовый файл
        new_settings = {
            "SMTP_HOST": str(cfg_data.get("smtp_host", "")).strip(),
            "SMTP_PORT": str(cfg_data.get("smtp_port", "465")).strip(),
            "SMTP_USER": str(cfg_data.get("smtp_user", "")).strip(),
            "SMTP_PASSWORD": str(cfg_data.get("smtp_password", "")).strip(),
            "SMTP_USE_TLS": str(cfg_data.get("use_tls", "True")).upper().strip()
        }

        updated_lines = []
        seen_keys = set()

        # Обновляем существующие ключи в .env, сохраняя остальную разметку и комментарии
        for line in lines:
            stripped = line.strip()
            if stripped and "=" in stripped and not stripped.startswith("#"):
                key, _ = stripped.split("=", 1)
                key = key.strip()
                if key in new_settings:
                    updated_lines.append(f"{key}={new_settings[key]}\n")
                    seen_keys.add(key)
                    continue
            updated_lines.append(line)

        # Дописываем новые ключи, если их не было в файле осей
        for key, val in new_settings.items():
            if key not in seen_keys:
                updated_lines.append(f"{key}={val}\n")

        # Атомарно запечатываем обновленный конфиг на диск
        with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
            f.writelines(updated_lines)
        logger.info("[ИБ-АУДИТ] <<< Конфигурационный файл .env успешно перезаписан и сохранен на диск.")

        # =========================================================================
        # Безопасный RUNTIME REFRESH без клинча асинхронного ядра
        # =========================================================================
        # 1. Записываем строковые значения в окружение ОС (требование os.environ)
        for key, val in new_settings.items():
            os.environ[key] = str(val)

        # 2. Принудительно обновляем глобальные переменные в модуле utils
        # С СОХРАНЕНИЕМ правильных типов (bool и int), чтобы не уронить фоновые воркеры
        import utils
        utils.SMTP_HOST = str(cfg_data.get("smtp_host", ""))
        utils.SMTP_PORT = int(cfg_data.get("smtp_port", 465))
        utils.SMTP_USER = str(cfg_data.get("smtp_user", ""))
        utils.SMTP_PASSWORD = str(cfg_data.get("smtp_password", ""))
        utils.SMTP_USE_TLS = True if str(cfg_data.get("use_tls", "True")).upper() in ["TRUE", "1", "YES"] else False

        logger.info("[ИБ-АУДИТ] Оперативная память процесса (RAM) успешно синхронизирована. Типы данных валидны.")

    except Exception as e:
        logger.error(f"[ИБ-КРАХ] Сбой файловой системы Linux при перезаписи .env файла: {str(e)}", exc_info=True)
        raise OSError(f"Сбой файловой системы Linux при перезаписи {ENV_FILE_PATH}: {str(e)}")


# =========================================================================
# # 1. СОХРАНЕНИЕ И ОБНОВЛЕНИЕ КОНФИГУРАЦИИ SMTP
# =========================================================================
@router.post("/config")
@router.post("/config/")
async def save_smtp_config(
    config: SmtpConfigSchema,
    current_user: str = Depends(RoleChecker(["admin"]))
):
    """Принимает JSON с фронтенда, шьет его в .env и моментально применяет в рантайме"""
    logger.info(f"[ИБ-АУДИТ] >>> ЗАПРОС ИЗМЕНЕНИЯ НАСТРОЕК SMTP | Администратор: '{current_user}' | Шлюз: {config.smtp_host}:{config.smtp_port}")

    try:
        # ИБ-ФИКС: Используем run_in_threadpool, чтобы тяжелая синхронная запись на диск 
        # выполнялась в изолированном пуле потоков и не вызывала дедлока асинхронного ядра uvicorn!
        from fastapi.concurrency import run_in_threadpool
        await run_in_threadpool(write_config_to_env, config)

        logger.info(f"[ИБ-АУДИТ] <<< Конфигурация SMTP сервера успешно запечатана и применена в рантайме администратором '{current_user}'.")
        return {
            "status": "success",
            "message": "Конфигурация SMTP сервера успешно запечатана в файл .env и применена в рантайме!"
        }

    except Exception as e:
        # КРИТИЧНО ДЛЯ ИБ: Пишем подробный Traceback падения файловой системы в журнал РЕД ОС
        logger.error(f"[ИБ-КРАХ] Не удалось обновить настройки SMTP для пользователя '{current_user}': {str(e)}", exc_info=True)
        
        # Маскируем системную ошибку для фронтенда, отдавая безопасный плоский JSON
        raise HTTPException(
            status_code=500,
            detail="Ошибка файловой системы сервера. Не удалось перезаписать конфигурационный файл .env."
        )

# =========================================================================
# # 2. ОТПРАВКА ТЕСТОВОГО ИБ-АЛЕРТА
# =========================================================================
@router.post("/test-send")
@router.post("/test-send/")
async def send_test_email(
    payload: TestEmailSchema,
    current_user: str = Depends(RoleChecker(["admin"]))
):
    """Асинхронно отправляет тестовое ИБ-письмо, используя актуальные параметры из RAM"""
    logger.info(f"[ИБ-АУДИТ] >>> ЗАПРОС ТЕСТОВОЙ ПОЧТЫ | Администратор: '{current_user}' | Получатель: '{payload.recipient}'")

    # Считываем боевые переменные рантайма, которые мы синхронизировали в ОЗУ
    import utils
    smtp_host = os.environ.get("SMTP_HOST", "smtp.yandex.ru")
    try:
        smtp_port = int(os.environ.get("SMTP_PORT", "465"))
    except ValueError:
        smtp_port = 465

    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_password = os.environ.get("SMTP_PASSWORD", "")

    # Всеядный парсинг флага TLS
    env_tls = os.environ.get("SMTP_USE_TLS", "TRUE").upper()
    is_tls_enabled = True if env_tls in ["TRUE", "1", "YES"] else False

    if not smtp_user or not smtp_password:
        logger.warning(f"[ИБ-АУДИТ] !!! СБОЙ ОТПРАВКИ | Почтовый шлюз не настроен в .env. Запрос от '{current_user}'")
        raise HTTPException(status_code=400, detail="Почтовый шлюз не настроен! Сначала сохраните конфигурацию SMTP серверов.")

    # Сборка ИБ-письма MIMEMultipart
    message = MIMEMultipart()
    message["From"] = smtp_user
    message["To"] = payload.recipient
    message["Subject"] = "🔒 ТЕСТ: Проверка защищенного почтового шлюза панели СУБД"

    html_body = f"""
    <html>
    <body style="font-family: sans-serif; color: #1e293b; padding: 20px; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-top: 0;">Панель управления правами PostgreSQL</h2>
    <p style="font-size: 1rem; color: #475569; line-height: 1.5;">Почтовый шлюз оповещений ИБ успешно привязан к файлу <code>/opt/pgrights_manager/.env</code>, прошел рантайм-авторизацию и готов к работе в Production периметре.</p>
    <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 14px; border-radius: 6px; margin: 20px 0; font-family: monospace; font-size: 0.9rem;">
    <strong>СТАТУС ШЛЮЗА:</strong> <span style="color: #16a34a; font-weight: bold;">CONNECTED (ACTIVE)</span><br>
    <strong>SMTP ХОСТ:</strong> {smtp_host}<br>
    <strong>SMTP ПОРТ:</strong> {smtp_port}<br>
    <strong>ОТПРАВИТЕЛЬ:</strong> {smtp_user}
    </div>
    <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">Это системное ИБ-уведомление отправлено в автоматическом режиме, отвечать на него не требуется.</p>
    </div>
    </body>
    </html>
    """
    message.attach(MIMEText(html_body, "html", "utf-8"))

    # ИБ-ФИКС: Разделяем логику прямого SSL (порт 465) и апгрейда STARTTLS (порт 587 или другие)
    use_direct_ssl = True if is_tls_enabled and smtp_port == 465 else False
    use_start_tls = True if is_tls_enabled and smtp_port != 465 else False

    try:
        # Инициализируем асинхронный почтовый клиент со строгими ИБ-таймаутами
        smtp_client = aiosmtplib.SMTP(
            hostname=smtp_host,
            port=smtp_port,
            use_tls=use_direct_ssl,
            start_tls=use_start_tls,
            timeout=10
        )

        await smtp_client.connect()
        await smtp_client.login(smtp_user, smtp_password)
        await smtp_client.send_message(message)
        await smtp_client.quit()

        logger.info(f"[ИБ-АУДИТ] <<< Тестовый ИБ-алерт успешно отправлен на адрес '{payload.recipient}' администратором '{current_user}'.")
        return {"status": "success", "message": f"Тестовый ИБ-алерт успешно отправлен на адрес {payload.recipient}!"}

    except aiosmtplib.SMTPAuthenticationError:
        logger.warning(f"[ИБ-АУДИТ] !!! ОТКАЗ SMTP | Ошибка авторизации на почтовом сервере {smtp_host}. Неверный логин или пароль приложения.")
        raise HTTPException(status_code=401, detail="Ошибка авторизации на SMTP сервере! Проверьте правильность логина или пароля приложения.")

    except Exception as e:
        # КРИТИЧНО ДЛЯ ИБ: Записываем сетевой крах линка с почтовым сервером в журнал с подробной трассировкой
        logger.error(f"[ИБ-КРАХ] Фатальная ошибка подключения к почтовому шлюзу для '{current_user}': {str(e)}", exc_info=True)
        # Маскируем сырые технические детали, защищая архитектуру корпоративной сети
        raise HTTPException(status_code=500, detail="Ошибка выполнения операции. Не удалось установить соединение с внешним почтовым шлюзом.")
