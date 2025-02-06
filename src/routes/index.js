const InventoryController = require('../controllers/inventory_controller')
const BulkuploadController = require('../controllers/bulkupload_controller')
const EComController = require('../controllers/e-com_controller')
const UserController = require('../controllers/user_controller')
const OrderController = require('../controllers/order_controller')
const PaymentController = require('../controllers/payment_controller')
const DashboardController = require('../controllers/dashboard_controller')
const ImgToURLConverter = require('../controllers/imgToUrlConverter_controller')
const OAuthController = require('../controllers/oAuth_controller')
const TokenController = require('../controllers/token_controller')
const StoreController = require('../controllers/store_controller')
const CouponController = require('../controllers/coupon_controller')
const ContactController = require('../controllers/contact_controller')

class IndexRoute {
  constructor(expressApp) {
    this.app = expressApp
  }

  async initialize() {
    this.app.use('/inventory', InventoryController)
    this.app.use('/bulkUpload', BulkuploadController)
    this.app.use('/e-com', EComController)
    this.app.use('/user', UserController)
    this.app.use('/order', OrderController)
    this.app.use('/payment', PaymentController)
    this.app.use('/dashboard', DashboardController)
    this.app.use('/uploadToS3', ImgToURLConverter)
    this.app.use('/oAuth', OAuthController)
    this.app.use('/token', TokenController)
    this.app.use('/store', StoreController)
    this.app.use('/coupon', CouponController)
    this.app.use('/contact', ContactController)
  }
}

module.exports = IndexRoute;
