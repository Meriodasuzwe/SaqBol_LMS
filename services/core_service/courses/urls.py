from django.urls import path
from .views import (
    CourseListView, 
    CourseDetailView, 
    CategoryListView,
    EnrollCourseView, 
    LessonListCreateView,
    MyCoursesView,
    LessonDetailView,
    BulkCreateCourseView,
    LessonStepDetailView,
    LessonStepCreateView,
    MarkStepCompleteView,
    RejectCourseView,

    upload_image,
    CreateStripeCheckoutSessionView,
    stripe_webhook,
    # === НОВЫЕ ВЬЮХИ ДЛЯ АДМИН ПАНЕЛИ ===
    PendingCoursesView,
    ApproveCourseView
)

urlpatterns = [
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path('bulk-create/', BulkCreateCourseView.as_view(), name='course-bulk-create'), 
    path('my_courses/', MyCoursesView.as_view(), name='my-courses'),
    
    path('', CourseListView.as_view(), name='course-list'),
    path('<int:pk>/', CourseDetailView.as_view(), name='course-detail'),
    path('<int:pk>/enroll/', EnrollCourseView.as_view(), name='course-enroll'),
    
    # ССЫЛКА НА ОПЛАТУ STRIPE И ВЕБХУК
    path('<int:course_id>/create-checkout-session/', CreateStripeCheckoutSessionView.as_view(), name='create-checkout-session'),
    path('webhook/stripe/', stripe_webhook, name='stripe-webhook'),

    path('<int:course_id>/lessons/', LessonListCreateView.as_view(), name='course-lessons'),
    path('lessons/<int:pk>/', LessonDetailView.as_view(), name='lesson-detail'),
    
    path('lessons/<int:lesson_id>/steps/', LessonStepCreateView.as_view(), name='step-create'),
    path('steps/<int:pk>/complete/', MarkStepCompleteView.as_view(), name='step-complete'),
    path('steps/<int:pk>/', LessonStepDetailView.as_view(), name='step-detail'),
    
    path('upload-image/', upload_image, name='upload-image'),

    # === МАРШРУТЫ ДЛЯ АДМИН ПАНЕЛИ (МОДЕРАЦИЯ КУРСОВ) ===
    path('admin/pending/', PendingCoursesView.as_view(), name='admin_pending_courses'),
    path('admin/<int:pk>/approve/', ApproveCourseView.as_view(), name='admin_approve_course'),
    path('admin/<int:pk>/reject/', RejectCourseView.as_view(), name='admin_reject_course'),
]