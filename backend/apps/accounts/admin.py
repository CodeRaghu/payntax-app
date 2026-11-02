from django.contrib import admin

from .models import Firm, Invitation, User


@admin.register(Firm)
class FirmAdmin(admin.ModelAdmin):
    list_display = ["name", "created_at"]
    search_fields = ["name"]


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ["email", "full_name", "firm", "role", "is_active"]
    list_filter = ["role", "is_active"]
    search_fields = ["email", "full_name"]
    exclude = ["password"]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ["email", "firm", "role", "expires_at", "accepted_at"]
    exclude = ["token"]
