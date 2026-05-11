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
    ReviewListCreateView,
    MyCertificatesView,
    VerifyCertificateView,
    ReviewDeleteView,
    promo_slots,
    upload_image,
    CreateStripeCheckoutSessionView,
    stripe_webhook,
    ChatReplyView,
    ChangeCertificateLanguageView,
    B2BLeadCreateView,
    B2BLeadListView,
    B2BLeadUpdateView,
    PendingCoursesView,
    ApproveCourseView,
    GenerateCorporateInviteView,
    B2BDashboardView,
    RevokeEmployeeAccessView,
    B2BLeadDeleteView,
    ActivateInviteView
)

urlpatterns = [
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path('bulk-create/', BulkCreateCourseView.as_view(), name='course-bulk-create'), 
    path('my_courses/', MyCoursesView.as_view(), name='my-courses'),
    
    path('', CourseListView.as_view(), name='course-list'),
    path('<int:course_id>/reviews/', ReviewListCreateView.as_view(), name='course-reviews'),
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
    
    path('steps/<int:pk>/chat-reply/', ChatReplyView.as_view()),
    path('reviews/<int:pk>/', ReviewDeleteView.as_view(), name='review-delete'),

    path('certificates/my/', MyCertificatesView.as_view(), name='my-certificates'),

    # Для страницы верификации
    path('certificates/verify/<uuid:cert_id>/', VerifyCertificateView.as_view(), name='verify-certificate'),
    
    # Для переключения языка сертификата
    path('certificates/<uuid:cert_id>/change-language/', ChangeCertificateLanguageView.as_view(), name='change-certificate-language'),
    
    # === B2B ЗАЯВКИ И ИНВАЙТ-КОДЫ ===
    path('b2b/leads/create/', B2BLeadCreateView.as_view(), name='b2b-lead-create'),
    path('b2b/leads/', B2BLeadListView.as_view(), name='b2b-lead-list'),
    path('b2b/leads/<int:pk>/update/', B2BLeadUpdateView.as_view(), name='b2b-lead-update'),
    
    #
    path('b2b/leads/<int:pk>/', B2BLeadDeleteView.as_view(), name='b2b-lead-delete'),
    
    path('b2b/dashboard/', B2BDashboardView.as_view(), name='b2b-dashboard'),
    
    # Маршрут для генерации кода админом в панели:
    path('b2b/leads/<int:lead_id>/generate-invite/', GenerateCorporateInviteView.as_view(), name='generate-invite'),
    # Маршрут для активации кода студентом на странице курса:
    path('<int:course_id>/activate-invite/', ActivateInviteView.as_view(), name='activate-invite'),
    path('b2b/invites/<str:invite_code>/revoke/<int:user_id>/', RevokeEmployeeAccessView.as_view(), name='revoke-access'),
    path('courses/promo-slots/', promo_slots, name='promo-slots'),

    # === МАРШРУТЫ ДЛЯ АДМИН ПАНЕЛИ (МОДЕРАЦИЯ КУРСОВ) ===
    path('admin/pending/', PendingCoursesView.as_view(), name='admin_pending_courses'),
    path('admin/<int:pk>/approve/', ApproveCourseView.as_view(), name='admin_approve_course'),
    path('admin/<int:pk>/reject/', RejectCourseView.as_view(), name='admin_reject_course'),
]