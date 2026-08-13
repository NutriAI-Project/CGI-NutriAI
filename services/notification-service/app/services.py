"""
Notification Service - Service Bus Consumer + Email Sender
Background asyncio task that subscribes to Service Bus and sends meal reminder emails.
"""

import asyncio
import json
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.database import get_db_session
from app.models import Notification

logger = logging.getLogger(__name__)
settings = get_settings()


def build_welcome_email_html(data: dict) -> str:
    """Build styled HTML email for welcome message."""
    app_url = settings.APP_URL
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to NutriAI</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                background-color: #F8FAFC;
                color: #1E293B;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background-color: #FFFFFF;
                border: 1px solid #E2E8F0;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }}
            .header {{
                background-color: #0F766E;
                padding: 32px 24px;
                text-align: center;
            }}
            .header h1 {{
                color: #FFFFFF;
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: -0.02em;
            }}
            .header p {{
                color: #CCFBF1;
                margin: 8px 0 0;
                font-size: 14px;
            }}
            .content {{
                padding: 32px 24px;
                line-height: 1.6;
            }}
            .greeting {{
                font-size: 20px;
                font-weight: 700;
                color: #0F172A;
                margin-top: 0;
                margin-bottom: 16px;
            }}
            .intro-text {{
                font-size: 15px;
                color: #475569;
                margin-bottom: 24px;
            }}
            .timing-card {{
                background-color: #F8FAFC;
                border: 1px solid #E2E8F0;
                border-radius: 6px;
                padding: 20px;
                margin-bottom: 24px;
            }}
            .timing-card h3 {{
                font-size: 16px;
                font-weight: 600;
                color: #0F172A;
                margin-top: 0;
                margin-bottom: 12px;
            }}
            .timing-list {{
                padding: 0;
                margin: 0;
            }}
            .timing-item {{
                padding: 8px 0;
                border-bottom: 1px solid #E2E8F0;
                font-size: 14px;
            }}
            .timing-item:last-child {{
                border-bottom: none;
                padding-bottom: 0;
            }}
            .timing-label {{
                font-weight: 600;
                color: #1E293B;
                display: inline-block;
                width: 100px;
            }}
            .timing-value {{
                color: #0D9488;
                font-weight: 600;
            }}
            .timing-desc {{
                color: #64748B;
                margin-left: 8px;
            }}
            .action-area {{
                text-align: center;
                margin-top: 32px;
                margin-bottom: 16px;
            }}
            .btn {{
                display: inline-block;
                background-color: #0D9488;
                color: #FFFFFF !important;
                padding: 12px 32px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                font-size: 15px;
                box-shadow: 0 4px 6px -1px rgba(13, 148, 136, 0.2);
            }}
            .btn:hover {{
                background-color: #0F766E;
            }}
            .footer {{
                background-color: #F8FAFC;
                border-top: 1px solid #E2E8F0;
                padding: 24px;
                text-align: center;
                font-size: 12px;
                color: #64748B;
            }}
            .footer p {{
                margin: 0 0 8px;
            }}
            .footer p:last-child {{
                margin-bottom: 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>NutriAI Health Portal</h1>
                <p>Your Intelligent Nutrition Companion</p>
            </div>
            <div class="content">
                <h2 class="greeting">Welcome to NutriAI!</h2>
                <p class="intro-text">
                    We are thrilled to accompany you on your health and wellness journey. 
                    NutriAI uses state-of-the-art clinical intelligence to analyze your uploaded medical records, 
                    allergy profiles, and dietary preferences to curate highly customized, nutritionally balanced plans. 
                    Your first personalized plan is now fully generated and active!
                </p>
                <div class="timing-card">
                    <h3>⏰ Scheduled Meal Reminders</h3>
                    <p style="margin-top: 0; margin-bottom: 16px; font-size: 14px; color: #475569;">
                        To support your consistency, NutriAI will automatically send email reminders at scheduled times containing your exact planned menu, recommended foods, and custom nutrition tips.
                    </p>
                    <div class="timing-list">
                        <div class="timing-item">
                            <span class="timing-label">🌅 Breakfast</span>
                            <span class="timing-value">8:00 AM IST</span>
                            <span class="timing-desc">(Start with key energy foods)</span>
                        </div>
                        <div class="timing-item">
                            <span class="timing-label">☀️ Lunch</span>
                            <span class="timing-value">1:00 PM IST</span>
                            <span class="timing-desc">(Stay fueled and alert)</span>
                        </div>
                        <div class="timing-item">
                            <span class="timing-label">🍎 Snacks</span>
                            <span class="timing-value">4:00 PM IST</span>
                            <span class="timing-desc">(Healthy mid-day boost)</span>
                        </div>
                        <div class="timing-item">
                            <span class="timing-label">🌙 Dinner</span>
                            <span class="timing-value">8:00 PM IST</span>
                            <span class="timing-desc">(Nourishing recovery meal)</span>
                        </div>
                    </div>
                </div>
                <div class="action-area">
                    <a href="{app_url}/dashboard" class="btn">Access Your Dashboard</a>
                </div>
            </div>
            <div class="footer">
                <p>This welcome email was sent to verify your automated notification preferences.</p>
                <p>© 2026 NutriAI Health Portal. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html


def build_meal_reminder_html(data: dict) -> str:
    """Build styled HTML email for meal reminder."""
    meal_type = data.get("meal_type", "meal").capitalize()
    day_name = data.get("day_name", "Today")
    foods_to_eat = data.get("foods_to_eat", [])
    foods_to_avoid = data.get("foods_to_avoid", [])
    meal_description = data.get("meal_description", "")
    app_url = settings.APP_URL

    eat_rows = ""
    for food in foods_to_eat:
        eat_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; color: #1E293B; font-weight: 600; font-size: 14px;">{food.get('food_name', '')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; color: #475569; font-size: 14px;">{food.get('portion_size', '')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; color: #475569; font-size: 14px;">{food.get('timing', '')}</td>
        </tr>"""

    avoid_rows = ""
    for food in foods_to_avoid:
        avoid_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; color: #1E293B; font-weight: 600; font-size: 14px;">{food.get('food_name', '')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; color: #475569; font-size: 14px;">{food.get('reason', '')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; color: #B91C1C; font-weight: 500; font-size: 13px;">{food.get('risk_level', '').upper()}</td>
        </tr>"""

    menu_block = ""
    if meal_description:
        menu_block = f"""
        <div style="background-color: #F0FDFA; border-left: 4px solid #0D9488; padding: 20px; margin-bottom: 28px; border-radius: 6px; border: 1px solid #CCFBF1; border-left-width: 4px;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #0D9488; display: block; margin-bottom: 6px;">Menu details</span>
            <p style="margin: 0; color: #0F172A; font-size: 16px; line-height: 1.5; font-weight: 600;">{meal_description}</p>
        </div>
        """

    eat_table = ""
    if foods_to_eat:
        eat_table = f"""
        <div style="margin-bottom: 28px;">
            <h3 style="color: #0F172A; font-size: 16px; font-weight: 700; margin-top: 0; margin-bottom: 12px; display: flex; align-items: center;">
                <span style="color: #0D9488; margin-right: 8px;">✅</span> Recommended Foods
            </h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden;">
                <thead>
                    <tr style="background-color: #F8FAFC; border-bottom: 2px solid #E2E8F0;">
                        <th style="padding: 10px 12px; text-align: left; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Food</th>
                        <th style="padding: 10px 12px; text-align: left; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Portion</th>
                        <th style="padding: 10px 12px; text-align: left; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Timing</th>
                    </tr>
                </thead>
                <tbody>
                    {eat_rows}
                </tbody>
            </table>
        </div>
        """

    avoid_table = ""
    if foods_to_avoid:
        avoid_table = f"""
        <div style="margin-bottom: 28px;">
            <h3 style="color: #0F172A; font-size: 16px; font-weight: 700; margin-top: 0; margin-bottom: 12px; display: flex; align-items: center;">
                <span style="color: #E11D48; margin-right: 8px;">❌</span> Foods to Limit / Avoid
            </h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden;">
                <thead>
                    <tr style="background-color: #FFF1F2; border-bottom: 2px solid #FFE4E6;">
                        <th style="padding: 10px 12px; text-align: left; color: #9F1239; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Food</th>
                        <th style="padding: 10px 12px; text-align: left; color: #9F1239; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Reason</th>
                        <th style="padding: 10px 12px; text-align: left; color: #9F1239; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Risk</th>
                    </tr>
                </thead>
                <tbody>
                    {avoid_rows}
                </tbody>
            </table>
        </div>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NutriAI Meal Reminder</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                background-color: #F8FAFC;
                color: #1E293B;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background-color: #FFFFFF;
                border: 1px solid #E2E8F0;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }}
            .header {{
                background-color: #0F766E;
                padding: 32px 24px;
                text-align: center;
            }}
            .header h1 {{
                color: #FFFFFF;
                margin: 0;
                font-size: 22px;
                font-weight: 700;
                letter-spacing: -0.02em;
            }}
            .header p {{
                color: #CCFBF1;
                margin: 8px 0 0;
                font-size: 14px;
            }}
            .content {{
                padding: 32px 24px;
            }}
            .action-area {{
                text-align: center;
                margin-top: 32px;
                margin-bottom: 16px;
            }}
            .btn {{
                display: inline-block;
                background-color: #0D9488;
                color: #FFFFFF !important;
                padding: 12px 32px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
                box-shadow: 0 4px 6px -1px rgba(13, 148, 136, 0.2);
            }}
            .btn:hover {{
                background-color: #0F766E;
            }}
            .footer {{
                background-color: #F8FAFC;
                border-top: 1px solid #E2E8F0;
                padding: 24px;
                text-align: center;
                font-size: 12px;
                color: #64748B;
            }}
            .footer p {{
                margin: 0 0 8px;
            }}
            .footer p:last-child {{
                margin-bottom: 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🍽️ NutriAI Meal Reminder</h1>
                <p>Your custom {meal_type.lower()} menu for {day_name}</p>
            </div>
            <div class="content">
                {menu_block}
                {eat_table}
                {avoid_table}
                <div class="action-area">
                    <a href="{app_url}/dashboard" class="btn">View Full Diet Plan</a>
                </div>
            </div>
            <div class="footer">
                <p>To configure your reminder schedules and options, please visit your portal dashboard settings.</p>
                <p>© 2026 NutriAI Health Portal. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html


def send_email_smtp(to_email: str, subject: str, html_content: str):
    """Send email via SMTP."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())

        logger.info(f"Email sent via SMTP to {to_email}")
    except (smtplib.SMTPException, OSError) as e:
        logger.error(f"SMTP email error: {e}")
        raise


def send_email(to_email: str, subject: str, html_content: str):
    """Send email using SMTP."""
    send_email_smtp(to_email, subject, html_content)


async def service_bus_consumer():
    """Background asyncio task that subscribes to Service Bus and processes meal reminders.

    Authentication priority:
      1. If AZURE_SERVICE_BUS_CONNECTION_STRING is set → use connection string (local dev / fallback).
      2. Otherwise → use DefaultAzureCredential (AKS Workload Identity in production).
    """
    if not settings.AZURE_SERVICE_BUS_CONNECTION_STRING and not settings.AZURE_SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE:
        logger.warning("Neither Service Bus connection string nor fully qualified namespace configured. Consumer disabled.")
        return

    try:
        from azure.servicebus.aio import ServiceBusClient as AsyncServiceBusClient

        if settings.AZURE_SERVICE_BUS_CONNECTION_STRING:
            # --- Local dev / fallback: connection string auth ---
            logger.info("Starting Service Bus consumer with connection string auth...")
            sb_client = AsyncServiceBusClient.from_connection_string(
                settings.AZURE_SERVICE_BUS_CONNECTION_STRING
            )
        else:
            # --- Production: Workload Identity via DefaultAzureCredential ---
            logger.info("Starting Service Bus consumer with DefaultAzureCredential (Workload Identity)...")
            from azure.identity.aio import DefaultAzureCredential
            credential = DefaultAzureCredential()
            sb_client = AsyncServiceBusClient(
                fully_qualified_namespace=settings.AZURE_SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE,
                credential=credential,
            )

        async with sb_client:
            receiver = sb_client.get_subscription_receiver(
                topic_name=settings.AZURE_SERVICE_BUS_TOPIC_NAME,
                subscription_name=settings.AZURE_SERVICE_BUS_SUBSCRIPTION_NAME,
            )

            async with receiver:
                while True:
                    try:
                        messages = await receiver.receive_messages(max_message_count=10, max_wait_time=30)

                        for msg in messages:
                            try:
                                body = json.loads(str(msg))
                                user_email = body.get("user_email", "")
                                meal_type = body.get("meal_type", "meal").capitalize()
                                day_name = body.get("day_name", "Today")

                                if user_email:
                                    if meal_type.lower() == "welcome":
                                        subject = "Welcome to NutriAI!"
                                        html = build_welcome_email_html(body)
                                    else:
                                        subject = f"NutriAI Reminder: Your {meal_type} for {day_name}"
                                        html = build_meal_reminder_html(body)
                                    send_email(user_email, subject, html)

                                # Create notification record
                                db = get_db_session()
                                try:
                                    if meal_type.lower() == "welcome":
                                        notification_msg = "Welcome to NutriAI! Your diet plan is ready and we sent a welcome email to your address."
                                        notification_icon = "fa-hand-spock"
                                    else:
                                        notification_msg = f"Meal reminder: {meal_type} for {day_name} has been sent to your email."
                                        notification_icon = "fa-utensils"

                                    import uuid as _uuid
                                    raw_uid = body.get("user_id")
                                    uid_val = _uuid.UUID(raw_uid) if isinstance(raw_uid, str) else raw_uid

                                    notification = Notification(
                                        user_id=uid_val,
                                        message=notification_msg,
                                        type="success",
                                        icon=notification_icon,
                                        is_read=False,
                                        email_sent=True,
                                    )
                                    db.add(notification)
                                    db.commit()
                                finally:
                                    db.close()

                                await receiver.complete_message(msg)
                                logger.info(f"Processed meal reminder for {user_email}: {meal_type} - {day_name}")

                            except (SQLAlchemyError, ValueError, KeyError) as e:
                                logger.error(f"Error processing message: {e}")
                                await receiver.abandon_message(msg)

                    except (OSError, RuntimeError) as e:
                        logger.error(f"Service Bus receive error: {e}")
                        await asyncio.sleep(10)

    except ImportError as e:
        logger.warning(f"azure-servicebus or its dependencies (like aiohttp) not installed, consumer disabled. Details: {e}")
    except (OSError, RuntimeError) as e:
        logger.error(f"Service Bus consumer fatal error: {e}")

