import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useNotifications } from "../../lib/notifications";
import { cn } from "../../lib/utils";

export function NotificationSystem() {
  const { notifications, removeNotification, markAsRead } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50 text-green-800';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'info':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-800';
    }
  };

  // Auto-mark as read after a short delay
  useEffect(() => {
    notifications.forEach((notification) => {
      if (!notification.isRead) {
        const timer = setTimeout(() => {
          markAsRead(notification.id);
        }, 1000);
        return () => clearTimeout(timer);
      }
    });
  }, [notifications, markAsRead]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            'flex items-start gap-3 p-4 rounded-lg border shadow-lg transition-all duration-300 transform',
            getStyles(notification.type),
            notification.isRead ? 'opacity-75' : 'opacity-100'
          )}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">{notification.title}</h4>
            <p className="text-sm mt-1 opacity-90">{notification.message}</p>
            
            {notification.action && (
              <button
                onClick={notification.action.onClick}
                className="mt-2 px-3 py-1 text-xs font-medium rounded bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
              >
                {notification.action.label}
              </button>
            )}
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="text-xs opacity-60">
              {new Date(notification.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Componente para el contador de notificaciones no leídas
export function NotificationBadge() {
  const { getUnreadCount } = useNotifications();
  const unreadCount = getUnreadCount();

  if (unreadCount === 0) return null;

  return (
    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
      {unreadCount > 99 ? '99+' : unreadCount}
    </div>
  );
}
