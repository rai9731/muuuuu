<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CowController;
use App\Http\Controllers\Api\MyCowController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PublicController;
use App\Http\Controllers\Api\Admin\AdminController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProfileController;
use Illuminate\Support\Facades\Route;

Route::get('/public/config', [PublicController::class, 'config']);
Route::get('/public/landing', [PublicController::class, 'landing']);
Route::get('/breeds', [PublicController::class, 'breeds']);

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
});

// Webhook LOCAL e SIMULADO (desligado sem SIMULATED_WEBHOOK_TOKEN; não é o webhook do Asaas).
Route::post('/webhooks/simulated-pix', \App\Http\Controllers\Api\SimulatedWebhookController::class)->middleware('throttle:60,1');

Route::get('/cows', [CowController::class, 'index']);
Route::get('/cows/{id}', [CowController::class, 'show'])->whereNumber('id');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/unread-counts', [NotificationController::class, 'unreadCounts']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/since', [NotificationController::class, 'since']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::post('/conversations', [ConversationController::class, 'store']);
    Route::get('/conversations/{id}', [ConversationController::class, 'show']);
    Route::post('/conversations/{id}/messages', [ConversationController::class, 'send']);

    Route::post('/cows/{id}/favorite', [CowController::class, 'toggleFavorite']);
    Route::get('/favorites', [CowController::class, 'favorites']);

    Route::get('/my/cows', [MyCowController::class, 'index']);
    Route::post('/my/cows', [MyCowController::class, 'store']);
    Route::get('/my/cows/{id}', [MyCowController::class, 'show']);
    Route::post('/my/cows/{id}', [MyCowController::class, 'update']);
    Route::patch('/my/cows/{id}/status', [MyCowController::class, 'status']);
    Route::delete('/my/cows/{id}', [MyCowController::class, 'destroy']);

    Route::get('/dashboard', [OrderController::class, 'dashboard']);
    Route::get('/checkout/{cowId}', [OrderController::class, 'checkoutPreview']);
    Route::post('/checkout/{cowId}', [OrderController::class, 'checkout']);
    Route::get('/my/purchases', [OrderController::class, 'purchases']);
    Route::get('/my/purchases/{id}', [OrderController::class, 'purchase']);
    Route::post('/my/purchases/{id}/simulate-payment', [OrderController::class, 'simulatePayment']);
    Route::post('/my/purchases/{id}/check-payment', [OrderController::class, 'checkPayment'])->middleware('throttle:20,1');
    Route::post('/my/purchases/{id}/confirm-delivery', [OrderController::class, 'confirmDelivery']);
    Route::post('/my/purchases/{id}/review', [OrderController::class, 'review']);
    Route::get('/my/sales', [OrderController::class, 'sales']);
    Route::post('/my/sales/{id}/ship', [OrderController::class, 'ship']);

    Route::post('/auth/change-password', [ProfileController::class, 'changePassword']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::post('/profile/avatar', [ProfileController::class, 'avatar']);
    Route::put('/profile/payout', [ProfileController::class, 'payout']);
    Route::put('/profile/notification-preferences', [ProfileController::class, 'preferences']);
    Route::get('/profile/export', [ProfileController::class, 'export']);
    Route::delete('/profile', [ProfileController::class, 'destroy']);

    Route::prefix('admin')->middleware('admin')->controller(AdminController::class)->group(function () {
        Route::get('/dashboard', 'dashboard');
        Route::get('/reports', 'reports');
        Route::get('/cows', 'cows');
        Route::get('/cows/{id}', 'cow');
        Route::post('/cows/{id}/approve', 'approveCow');
        Route::post('/cows/{id}/reject', 'rejectCow');
        Route::post('/cows/{id}/pause', 'pauseCow');
        Route::delete('/cows/{id}', 'deleteCow');
        Route::get('/users', 'users');
        Route::get('/users/{id}', 'user');
        Route::post('/users/{id}/block', 'blockUser');
        Route::post('/users/{id}/unblock', 'unblockUser');
        Route::post('/users/{id}/reset-password', 'resetPassword');
        Route::get('/password-requests', 'passwordRequests');
        Route::get('/sales', 'sales');
        Route::get('/sales/{id}', 'sale');
        Route::get('/payments', 'payments');
        Route::get('/settings', 'settings');
        Route::put('/settings', 'updateSettings');
        Route::post('/breeds', 'createBreed');
        Route::put('/breeds/{id}', 'updateBreed');
        Route::delete('/breeds/{id}', 'deleteBreed');
    });
});
