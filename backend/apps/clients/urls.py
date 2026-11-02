from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("clients", views.ClientViewSet, basename="clients")
urlpatterns = router.urls
