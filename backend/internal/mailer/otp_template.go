package mailer

import (
	"fmt"
	"html"
	"strings"
)

// OTPVerificationEmail — письмо с кодом входа в кабинет (text/plain + text/html).
func OTPVerificationEmail(code string) EmailMessage {
	code = strings.TrimSpace(code)
	esc := html.EscapeString(code)

	subject := "Гармония‑Мак — код для входа в кабинет"

	text := fmt.Sprintf(`Здравствуйте!

Ваш код для входа в личный кабинет:

    %s

Он действует 10 минут. Никому не сообщайте этот код — даже если представятся сотрудниками сервиса.

Если вы не запрашивали вход, просто удалите это письмо.

С уважением,
команда Гармония‑Мак
`, code)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="x-ua-compatible" content="ie=edge">
<title>Код для входа</title>
</head>
<body style="margin:0;padding:0;background-color:#eceff3;">
<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background-color:#eceff3;padding:40px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.08);">
<tr>
<td style="padding:28px 36px 12px;text-align:center;background:linear-gradient(180deg,#1e3a5f 0%%,#152a45 100%%);">
<p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#94a8c4;font-weight:600;">Гармония‑Мак</p>
<p style="margin:10px 0 0;font-size:19px;font-weight:600;color:#f8fafc;line-height:1.35;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Код для входа в кабинет</p>
</td>
</tr>
<tr>
<td style="padding:32px 36px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<p style="margin:0;font-size:16px;line-height:1.55;color:#334155;">Здравствуйте!</p>
<p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:#475569;">Введите код ниже, чтобы подтвердить адрес и войти в личный кабинет.</p>
</td>
</tr>
<tr>
<td align="center" style="padding:12px 36px 28px;">
<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:separate;border:1px solid #e2e8f0;border-radius:12px;background-color:#f8fafc;">
<tr>
<td style="padding:20px 36px;font-family:'SF Mono',ui-monospace,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:0.32em;color:#0f172a;text-align:center;">%s</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:0 36px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">Код действует <strong style="color:#475569;">10 минут</strong>. Никому не сообщайте его — в том числе если с вами свяжутся от имени сервиса.</p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#94a3b8;">Если вы не запрашивали вход, просто удалите это письмо.</p>
</td>
</tr>
<tr>
<td style="padding:20px 36px 28px;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">С уважением,<br><span style="color:#64748b;">команда Гармония‑Мак</span></p>
</td>
</tr>
</table>
<p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Это автоматическое сообщение, отвечать на него не нужно.</p>
</td>
</tr>
</table>
</body>
</html>`, esc)

	return EmailMessage{Subject: subject, Text: text, HTML: htmlBody}
}
