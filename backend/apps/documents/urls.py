from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("documents", views.DocumentViewSet, basename="documents")
urlpatterns = router.urls
