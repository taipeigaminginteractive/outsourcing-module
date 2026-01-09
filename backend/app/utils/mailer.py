"""
郵件發送服務
提供 SMTP 郵件發送功能，支持 HTML 模板
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import List, Optional

from app.core.errors import EmailSendError
from app.core.logging import get_logger
from jinja2 import Template
from settings import settings

logger = get_logger(__name__)

# ================================================
# 郵件服務類別
# ================================================

class EmailService:
    """郵件服務類"""

    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
        self.from_name = settings.SMTP_FROM_NAME
        self.use_tls = settings.SMTP_USE_TLS

    def _get_smtp_connection(self):
        """獲取 SMTP 連接"""
        # 認證模式：有設定帳號密碼時，使用原本的 TLS/SSL + 登入流程
        if self.smtp_user and self.smtp_password:
            if self.use_tls:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port)

            server.login(self.smtp_user, self.smtp_password)
            return server

        # 無認證模式：用於開發/測試環境 (例如 MailHog)，不啟用 TLS/SSL，也不登入
        # MailHog 預設運行在 1025 端口，接受匿名連線
        server = smtplib.SMTP(self.smtp_host, self.smtp_port)
        return server

    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        is_html: bool = True,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> bool:
        """
        發送郵件

        Args:
            to_email: 收件人郵箱
            subject: 郵件主題
            body: 郵件內容
            is_html: 是否為 HTML 格式
            cc: 抄送列表
            bcc: 密送列表

        Returns:
            bool: 發送成功返回 True，失敗返回 False
        """
        try:
            # 創建郵件
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email

            if cc:
                msg['Cc'] = ', '.join(cc)
            if bcc:
                msg['Bcc'] = ', '.join(bcc)

            # 添加郵件內容
            if is_html:
                msg.attach(MIMEText(body, 'html', 'utf-8'))
            else:
                msg.attach(MIMEText(body, 'plain', 'utf-8'))

            # 發送郵件
            with self._get_smtp_connection() as server:
                recipients = [to_email]
                if cc:
                    recipients.extend(cc)
                if bcc:
                    recipients.extend(bcc)

                server.sendmail(self.from_email, recipients, msg.as_string())

            return True

        except Exception as e:
            print(f"郵件發送失敗: {str(e)}")
            return False

    def send_template_email(
        self,
        to_email: str,
        subject: str,
        template_name: str,
        context: dict,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> bool:
        """
        使用模板發送郵件

        Args:
            to_email: 收件人郵箱
            subject: 郵件主題
            template_name: 模板文件名（不含路徑）
            context: 模板上下文變量
            cc: 抄送列表
            bcc: 密送列表

        Returns:
            bool: 發送成功返回 True，失敗返回 False
        """
        try:
            # 讀取模板
            template_path = Path(__file__).parent.parent.parent / "templates" / "email" / template_name

            if not template_path.exists():
                print(f"郵件模板不存在: {template_path}")
                return False

            with open(template_path, 'r', encoding='utf-8') as f:
                template_content = f.read()

            # 渲染模板
            template = Template(template_content)
            body = template.render(**context)

            # 發送郵件
            return self.send_email(
                to_email=to_email,
                subject=subject,
                body=body,
                is_html=True,
                cc=cc,
                bcc=bcc
            )

        except Exception as e:
            print(f"模板郵件發送失敗: {str(e)}")
            print(f"SMTP 配置: host={self.smtp_host}, port={self.smtp_port}, user={'已設置' if self.smtp_user else '未設置'}")
            return False


# 全局郵件服務實例 在內部使用 外部只要 import mailer 即可
email_service = EmailService()

# ================================================
# 便捷函數
# ================================================

async def send_verification_email(to_email: str, username: str, verification_token: str) -> None:
    """
    發送信箱驗證信

    Args:
        to_email: 收件人郵箱
        username: 用戶名
        verification_token: 驗證 token

    Raises:
        EmailSendError: 當郵件發送失敗時拋出
    """
    verification_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={verification_token}"

    context = {
        "username": username,
        "verification_url": verification_url,
        "frontend_url": settings.FRONTEND_URL,
        "app_name": settings.SMTP_FROM_NAME
    }

    success = email_service.send_template_email(
        to_email=to_email,
        subject=f"歡迎加入 {settings.SMTP_FROM_NAME} - 請驗證您的信箱",
        template_name="email_verification.html",
        context=context
    )
    
    if not success:
        logger.error(
            "驗證信發送失敗",
            extra={
                "to_email": to_email,
                "username": username,
            }
        )
        raise EmailSendError("verification")
