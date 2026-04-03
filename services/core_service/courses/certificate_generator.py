import os
import urllib.request
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from django.core.files.base import ContentFile
from django.conf import settings

def ensure_font_exists(font_path, font_url):
    """Проверяет наличие шрифта, если нет — скачивает его"""
    if not os.path.exists(font_path):
        os.makedirs(os.path.dirname(font_path), exist_ok=True)
        try:
            print(f"Скачиваю шрифт: {os.path.basename(font_path)}...")
            urllib.request.urlretrieve(font_url, font_path)
        except Exception as e:
            print(f"Ошибка скачивания шрифта: {e}")

def generate_certificate_image(certificate):
    """Генерирует картинку сертификата и сохраняет её"""
    assets_dir = os.path.join(settings.BASE_DIR, 'assets')
    os.makedirs(assets_dir, exist_ok=True)
    
    font_bold_path = os.path.join(assets_dir, 'Montserrat-Bold.ttf')
    font_regular_path = os.path.join(assets_dir, 'Montserrat-Regular.ttf')

    # Авто-загрузка кириллических шрифтов
    ensure_font_exists(font_bold_path, "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Bold.ttf")
    ensure_font_exists(font_regular_path, "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Regular.ttf")

    template_path = os.path.join(assets_dir, 'cert_template.png')
    
    # 1. Открываем шаблон или рисуем базовый красивый фон
    if os.path.exists(template_path):
        img = Image.open(template_path)
    else:
        # Если картинки-шаблона нет, рисуем строгий бело-серый холст с рамками
        img = Image.new('RGB', (1200, 800), color=(248, 250, 252))
        draw = ImageDraw.Draw(img)
        # Темно-синяя толстая рамка
        draw.rectangle([20, 20, 1180, 780], outline=(30, 58, 138), width=10)
        # Тонкая золотая рамка внутри
        draw.rectangle([35, 35, 1165, 765], outline=(200, 160, 50), width=2)

    draw = ImageDraw.Draw(img)

    # 2. Настраиваем размеры шрифтов
    try:
        font_title = ImageFont.truetype(font_bold_path, 80)
        font_name = ImageFont.truetype(font_bold_path, 64)
        font_course = ImageFont.truetype(font_bold_path, 40)
        font_small = ImageFont.truetype(font_regular_path, 24)
    except Exception:
        font_title = font_name = font_course = font_small = ImageFont.load_default()

    # 3. Данные для заполнения
    student_name = f"{certificate.student.first_name} {certificate.student.last_name}".strip()
    if not student_name:
        student_name = certificate.student.username
        
    course_title = certificate.course.title
    date_str = certificate.issued_at.strftime("%d.%m.%Y")
    cert_id = str(certificate.id).split('-')[0].upper()

    # Функция для центровки текста
    def draw_centered_text(y_pos, text, font, fill=(0, 0, 0)):
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        x_pos = (img.width - text_width) / 2
        draw.text((x_pos, y_pos), text, font=font, fill=fill)

    # 4. Отрисовка текста
    draw_centered_text(120, "СЕРТИФИКАТ", font_title, fill=(200, 160, 50)) # Золотой заголовок
    draw_centered_text(220, "О ПРОХОЖДЕНИИ КУРСА", font_small, fill=(100, 116, 139))

    draw_centered_text(360, student_name, font_name, fill=(30, 58, 138)) # Темно-синее имя
    draw_centered_text(460, "успешно завершил(а) программу", font_small, fill=(100, 116, 139))
    
    draw_centered_text(520, f"«{course_title}»", font_course, fill=(15, 23, 42))

    # Нижний колонтитул (ID и дата)
    draw.text((80, 710), f"Verify ID: {cert_id}", font=font_small, fill=(148, 163, 184))
    draw.text((920, 710), f"Дата: {date_str}", font=font_small, fill=(148, 163, 184))

    # 5. Сохраняем результат
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    image_data = buffer.getvalue()

    file_name = f"cert_{certificate.student.username}_{certificate.course.id}.png"
    certificate.file.save(file_name, ContentFile(image_data), save=True)
    
    return certificate