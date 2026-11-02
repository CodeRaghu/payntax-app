from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("returns", views.TaxReturnViewSet, basename="returns")
urlpatterns = router.urls
