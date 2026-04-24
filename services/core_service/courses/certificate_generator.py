import os
import urllib.request
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from django.core.files.base import ContentFile
from django.conf import settings

def ensure_font_exists(font_path, font_url):
    if not os.path.exists(font_path):
        os.makedirs(os.path.dirname(font_path), exist_ok=True)
        try:
            print(f"Скачиваю шрифт: {os.path.basename(font_path)}...")
            urllib.request.urlretrieve(font_url, font_path)
        except Exception as e:
            print(f"Ошибка скачивания шрифта: {e}")

# 🔥 Добавили параметр language (по умолчанию 'ru')
def generate_certificate_image(certificate, language='ru'):
    """Генерирует картинку сертификата и сохраняет её на выбранном языке"""
    assets_dir = os.path.join(settings.BASE_DIR, 'assets')
    os.makedirs(assets_dir, exist_ok=True)
    
    font_bold_path = os.path.join(assets_dir, 'Montserrat-Bold.ttf')
    font_regular_path = os.path.join(assets_dir, 'Montserrat-Regular.ttf')

    ensure_font_exists(font_bold_path, "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Bold.ttf")
    ensure_font_exists(font_regular_path, "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Regular.ttf")

    template_path = os.path.join(assets_dir, 'cert_template.png')
    
    if os.path.exists(template_path):
        img = Image.open(template_path)
    else:
        img = Image.new('RGB', (1200, 800), color=(248, 250, 252))
        draw = ImageDraw.Draw(img)
        draw.rectangle([20, 20, 1180, 780], outline=(30, 58, 138), width=10)
        draw.rectangle([35, 35, 1165, 765], outline=(200, 160, 50), width=2)

    draw = ImageDraw.Draw(img)

    try:
        font_title = ImageFont.truetype(font_bold_path, 80)
        font_name = ImageFont.truetype(font_bold_path, 64)
        font_course = ImageFont.truetype(font_bold_path, 40)
        font_small = ImageFont.truetype(font_regular_path, 24)
    except Exception:
        font_title = font_name = font_course = font_small = ImageFont.load_default()

    # 🔥 Словарик с переводами для холста
    translations = {
        'ru': {
            'title': "СЕРТИФИКАТ",
            'subtitle': "О ПРОХОЖДЕНИИ КУРСА",
            'completed': "успешно завершил(а) программу",
            'date': "Дата:"
        },
        'kk': {
            'title': "СЕРТИФИКАТ",
            'subtitle': "КУРСТЫ АЯҚТАҒАНЫ ТУРАЛЫ",
            'completed': "бағдарламаны сәтті аяқтады",
            'date': "Күні:"
        },
        'en': {
            'title': "CERTIFICATE",
            'subtitle': "OF COURSE COMPLETION",
            'completed': "has successfully completed the program",
            'date': "Date:"
        }
    }
    
    # Берем нужный язык или русский по дефолту
    t = translations.get(language, translations['ru'])

    student_name = f"{certificate.student.first_name} {certificate.student.last_name}".strip()
    if not student_name:
        student_name = certificate.student.username
        
    course_title = certificate.course.title
    date_str = certificate.issued_at.strftime("%d.%m.%Y")
    cert_id = str(certificate.id).split('-')[0].upper()

    def draw_centered_text(y_pos, text, font, fill=(0, 0, 0)):
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        x_pos = (img.width - text_width) / 2
        draw.text((x_pos, y_pos), text, font=font, fill=fill)

    # 🔥 Отрисовка с учетом языка
    draw_centered_text(120, t['title'], font_title, fill=(200, 160, 50)) 
    draw_centered_text(220, t['subtitle'], font_small, fill=(100, 116, 139))
    draw_centered_text(360, student_name, font_name, fill=(30, 58, 138)) 
    draw_centered_text(460, t['completed'], font_small, fill=(100, 116, 139))
    draw_centered_text(520, f"«{course_title}»", font_course, fill=(15, 23, 42))

    draw.text((80, 710), f"Verify ID: {cert_id}", font=font_small, fill=(148, 163, 184))
    draw.text((920, 710), f"{t['date']} {date_str}", font=font_small, fill=(148, 163, 184))

    buffer = BytesIO()
    img.save(buffer, format='PNG')
    image_data = buffer.getvalue()

    file_name = f"cert_{certificate.student.username}_{certificate.course.id}_{language}.png"
    certificate.file.save(file_name, ContentFile(image_data), save=True)
    
    return certificate