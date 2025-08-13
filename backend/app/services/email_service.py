"""
Email service for sending notifications and invitations.
Supports multiple providers: SMTP, SendGrid, Mailgun, etc.
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, Dict, Any, List
from jinja2 import Template

from app.core.config import settings

logger = logging.getLogger(__name__)

# =============================================================================
# EMAIL TEMPLATES
# =============================================================================

INVITATION_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invitation à rejoindre {{ organization_name }}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background-color: #f9f9f9; }
        .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Invitation à rejoindre {{ organization_name }}</h1>
        </div>
        <div class="content">
            <p>Bonjour,</p>
            
            <p><strong>{{ inviter_name }}</strong> vous invite à rejoindre <strong>{{ organization_name }}</strong> sur notre plateforme RAG.</p>
            
            <p>Cette invitation vous permettra d'accéder aux documents et conversations de l'organisation, selon les permissions qui vous ont été accordées.</p>
            
            <a href="{{ invitation_url }}" class="button">Accepter l'invitation</a>
            
            <p><small>Cette invitation expire le {{ expires_at.strftime('%d/%m/%Y à %H:%M') }}.</small></p>
            
            <p>Si vous ne souhaitez pas rejoindre cette organisation, vous pouvez ignorer ce message.</p>
            
            <p>Cordialement,<br>L'équipe RAG Support</p>
        </div>
        <div class="footer">
            <p>Cet email a été envoyé automatiquement. Merci de ne pas répondre à ce message.</p>
        </div>
    </div>
</body>
</html>
"""

PASSWORD_RESET_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Réinitialisation de votre mot de passe</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background-color: #f9f9f9; }
        .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Réinitialisation de mot de passe</h1>
        </div>
        <div class="content">
            <p>Bonjour,</p>
            
            <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte RAG Support.</p>
            
            <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
            
            <a href="{{ reset_url }}" class="button">Réinitialiser le mot de passe</a>
            
            <p><small>Ce lien expire dans {{ expires_in_hours }} heures.</small></p>
            
            <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer ce message.</p>
            
            <p>Cordialement,<br>L'équipe RAG Support</p>
        </div>
        <div class="footer">
            <p>Cet email a été envoyé automatiquement. Merci de ne pas répondre à ce message.</p>
        </div>
    </div>
</body>
</html>
"""

SECURITY_ALERT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Alerte de sécurité</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background-color: #fef2f2; border: 1px solid #fecaca; }
        .severity-{{ severity }} { border-left: 4px solid {% if severity == 'critical' %}#dc2626{% elif severity == 'high' %}#ea580c{% elif severity == 'medium' %}#d97706{% else %}#65a30d{% endif %}; padding-left: 15px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Alerte de Sécurité</h1>
        </div>
        <div class="content severity-{{ severity }}">
            <h2>{{ incident_title }}</h2>
            
            <p><strong>Organisation :</strong> {{ organization_name }}</p>
            <p><strong>Gravité :</strong> {{ severity.upper() }}</p>
            <p><strong>Date de détection :</strong> {{ detected_at.strftime('%d/%m/%Y à %H:%M') }}</p>
            
            <h3>Description</h3>
            <p>{{ incident_description }}</p>
            
            {% if affected_users > 0 %}
            <p><strong>Utilisateurs affectés :</strong> {{ affected_users }}</p>
            {% endif %}
            
            {% if affected_documents > 0 %}
            <p><strong>Documents affectés :</strong> {{ affected_documents }}</p>
            {% endif %}
            
            <h3>Actions recommandées</h3>
            <ul>
                <li>Connectez-vous à votre tableau de bord pour plus de détails</li>
                <li>Examinez les journaux de sécurité</li>
                <li>Contactez votre DPO si nécessaire</li>
            </ul>
            
            <p>Cordialement,<br>L'équipe Sécurité RAG</p>
        </div>
        <div class="footer">
            <p>Cet email a été envoyé automatiquement. Pour toute question, contactez le support.</p>
        </div>
    </div>
</body>
</html>
"""

# =============================================================================
# EMAIL SERVICE CLASS
# =============================================================================

class EmailService:
    """Email service with multiple provider support."""
    
    def __init__(self):
        self.provider = getattr(settings, 'email_provider', 'smtp')
        self.smtp_host = getattr(settings, 'smtp_host', 'localhost')
        self.smtp_port = getattr(settings, 'smtp_port', 587)
        self.smtp_username = getattr(settings, 'smtp_username', '')
        self.smtp_password = getattr(settings, 'smtp_password', '')
        self.smtp_use_tls = getattr(settings, 'smtp_use_tls', True)
        self.from_email = getattr(settings, 'from_email', 'noreply@raggy.fr')
        self.from_name = getattr(settings, 'from_name', 'RAG Support')
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """Send email using configured provider."""
        try:
            if self.provider == 'smtp':
                return await self._send_smtp_email(
                    to_email, subject, html_content, text_content, from_email, from_name
                )
            elif self.provider == 'sendgrid':
                return await self._send_sendgrid_email(
                    to_email, subject, html_content, text_content, from_email, from_name
                )
            elif self.provider == 'mailgun':
                return await self._send_mailgun_email(
                    to_email, subject, html_content, text_content, from_email, from_name
                )
            else:
                logger.error(f"Unsupported email provider: {self.provider}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False
    
    async def _send_smtp_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """Send email via SMTP."""
        try:
            from_addr = from_email or self.from_email
            from_display = f"{from_name or self.from_name} <{from_addr}>"
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = from_display
            msg['To'] = to_email
            
            # Add text and HTML parts
            if text_content:
                msg.attach(MIMEText(text_content, 'plain', 'utf-8'))
            msg.attach(MIMEText(html_content, 'html', 'utf-8'))
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.smtp_use_tls:
                    server.starttls()
                if self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"SMTP email error: {e}")
            return False
    
    async def _send_sendgrid_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """Send email via SendGrid."""
        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail, From, To, Content
            
            sg = sendgrid.SendGridAPIClient(api_key=getattr(settings, 'sendgrid_api_key'))
            
            mail = Mail(
                from_email=From(from_email or self.from_email, from_name or self.from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            if text_content:
                mail.content = [
                    Content("text/plain", text_content),
                    Content("text/html", html_content)
                ]
            
            response = sg.send(mail)
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"SendGrid email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"SendGrid error: {response.status_code} - {response.body}")
                return False
                
        except Exception as e:
            logger.error(f"SendGrid email error: {e}")
            return False
    
    async def _send_mailgun_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """Send email via Mailgun."""
        try:
            import requests
            
            domain = getattr(settings, 'mailgun_domain')
            api_key = getattr(settings, 'mailgun_api_key')
            
            if not domain or not api_key:
                logger.error("Mailgun configuration missing")
                return False
            
            from_addr = f"{from_name or self.from_name} <{from_email or self.from_email}>"
            
            data = {
                "from": from_addr,
                "to": to_email,
                "subject": subject,
                "html": html_content
            }
            
            if text_content:
                data["text"] = text_content
            
            response = requests.post(
                f"https://api.mailgun.net/v3/{domain}/messages",
                auth=("api", api_key),
                data=data,
                timeout=30
            )
            
            if response.status_code == 200:
                logger.info(f"Mailgun email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"Mailgun error: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Mailgun email error: {e}")
            return False

# =============================================================================
# EMAIL SERVICE INSTANCE
# =============================================================================

email_service = EmailService()

# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

async def send_invitation_email(
    email: str,
    organization_name: str,
    inviter_name: str,
    invitation_token: str,
    expires_at: datetime
) -> bool:
    """Send organization invitation email."""
    try:
        # Build invitation URL
        frontend_url = getattr(settings, 'frontend_url', 'https://app.raggy.fr')
        invitation_url = f"{frontend_url}/invitations/{invitation_token}/accept"
        
        # Render template
        template = Template(INVITATION_TEMPLATE)
        html_content = template.render(
            organization_name=organization_name,
            inviter_name=inviter_name,
            invitation_url=invitation_url,
            expires_at=expires_at
        )
        
        # Send email
        success = await email_service.send_email(
            to_email=email,
            subject=f"Invitation à rejoindre {organization_name}",
            html_content=html_content
        )
        
        if success:
            logger.info(f"Invitation email sent to {email} for organization {organization_name}")
        else:
            logger.error(f"Failed to send invitation email to {email}")
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending invitation email: {e}")
        return False

async def send_password_reset_email(
    email: str,
    reset_token: str,
    expires_in_hours: int = 24
) -> bool:
    """Send password reset email."""
    try:
        # Build reset URL
        frontend_url = getattr(settings, 'frontend_url', 'https://app.raggy.fr')
        reset_url = f"{frontend_url}/auth/reset-password?token={reset_token}"
        
        # Render template
        template = Template(PASSWORD_RESET_TEMPLATE)
        html_content = template.render(
            reset_url=reset_url,
            expires_in_hours=expires_in_hours
        )
        
        # Send email
        success = await email_service.send_email(
            to_email=email,
            subject="Réinitialisation de votre mot de passe",
            html_content=html_content
        )
        
        if success:
            logger.info(f"Password reset email sent to {email}")
        else:
            logger.error(f"Failed to send password reset email to {email}")
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending password reset email: {e}")
        return False

async def send_security_alert_email(
    email: str,
    organization_name: str,
    incident_title: str,
    incident_description: str,
    severity: str,
    detected_at: datetime,
    affected_users: int = 0,
    affected_documents: int = 0
) -> bool:
    """Send security incident alert email."""
    try:
        # Render template
        template = Template(SECURITY_ALERT_TEMPLATE)
        html_content = template.render(
            organization_name=organization_name,
            incident_title=incident_title,
            incident_description=incident_description,
            severity=severity.lower(),
            detected_at=detected_at,
            affected_users=affected_users,
            affected_documents=affected_documents
        )
        
        # Send email
        success = await email_service.send_email(
            to_email=email,
            subject=f"🚨 Alerte de sécurité - {organization_name}",
            html_content=html_content
        )
        
        if success:
            logger.info(f"Security alert email sent to {email} for organization {organization_name}")
        else:
            logger.error(f"Failed to send security alert email to {email}")
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending security alert email: {e}")
        return False

async def send_notification_email(
    emails: List[str],
    subject: str,
    content: str,
    organization_name: Optional[str] = None
) -> Dict[str, bool]:
    """Send notification email to multiple recipients."""
    results = {}
    
    for email in emails:
        try:
            # Build simple HTML content
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>{subject}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .content {{ padding: 30px; background-color: #f9f9f9; }}
                    .footer {{ padding: 20px; text-align: center; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="content">
                        {content}
                        {f'<p>Organisation : <strong>{organization_name}</strong></p>' if organization_name else ''}
                        <p>Cordialement,<br>L'équipe RAG Support</p>
                    </div>
                    <div class="footer">
                        <p>Cet email a été envoyé automatiquement.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            success = await email_service.send_email(
                to_email=email,
                subject=subject,
                html_content=html_content
            )
            
            results[email] = success
            
        except Exception as e:
            logger.error(f"Error sending notification to {email}: {e}")
            results[email] = False
    
    return results

# =============================================================================
# EMAIL VALIDATION
# =============================================================================

def is_valid_email(email: str) -> bool:
    """Basic email validation."""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def normalize_email(email: str) -> str:
    """Normalize email address."""
    return email.lower().strip()