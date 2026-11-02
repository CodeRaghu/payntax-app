from django.urls import path

from . import views

urlpatterns = [
    path("billing/plans", views.PlanList.as_view(), name="billing-plans"),
    path("billing/subscription", views.SubscriptionView.as_view(), name="billing-subscription"),
    path("billing/checkout", views.CheckoutView.as_view(), name="billing-checkout"),
    path("billing/portal", views.PortalView.as_view(), name="billing-portal"),
    path("billing/fake/complete", views.FakeCheckoutCompleteView.as_view(), name="billing-fake-complete"),
]
