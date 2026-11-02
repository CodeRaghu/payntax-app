from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("firm/users", views.FirmUserViewSet, basename="firm-users")
router.register("firm/invitations", views.InvitationViewSet, basename="firm-invitations")

urlpatterns = [
    path("auth/session", views.SessionView.as_view(), name="auth-session"),
    path("auth/signup", views.SignupView.as_view(), name="auth-signup"),
    path("auth/login", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/mfa/setup", views.MfaSetupView.as_view(), name="auth-mfa-setup"),
    path("auth/mfa/verify", views.MfaVerifyView.as_view(), name="auth-mfa-verify"),
    path("auth/invitations/<str:token>", views.InvitationPreviewView.as_view(), name="auth-invitation"),
    path(
        "auth/invitations/<str:token>/accept",
        views.AcceptInvitationView.as_view(),
        name="auth-invitation-accept",
    ),
    path("firm", views.FirmView.as_view(), name="firm"),
    *router.urls,
]
