// Sistema de notificaciones moderno para reemplazar alert()
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  timestamp: Date;
  isRead: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: uuidv4(),
      timestamp: new Date(),
      isRead: false,
      duration: notification.duration || (notification.type === 'error' ? 0 : 5000),
    };
    
    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));
    
    // Auto-remove notification after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(newNotification.id);
      }, newNotification.duration);
    }
  },
  
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
  
  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  },
  
  clearAll: () => {
    set({ notifications: [] });
  },
  
  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.isRead).length;
  },
}));

// Hook para facilitar el uso de notificaciones
export const useNotifications = () => {
  const store = useNotificationStore();
  
  const notify = {
    success: (title: string, message: string, options?: Partial<Notification>) => {
      store.addNotification({ type: 'success', title, message, ...options });
    },
    error: (title: string, message: string, options?: Partial<Notification>) => {
      store.addNotification({ type: 'error', title, message, ...options });
    },
    warning: (title: string, message: string, options?: Partial<Notification>) => {
      store.addNotification({ type: 'warning', title, message, ...options });
    },
    info: (title: string, message: string, options?: Partial<Notification>) => {
      store.addNotification({ type: 'info', title, message, ...options });
    },
  };
  
  return {
    ...store,
    notify,
  };
};

// Helper functions para reemplazar alert() comúnmente usados
export const showSuccess = (message: string, title = 'Éxito') => {
  const { addNotification } = useNotificationStore.getState();
  addNotification({ type: 'success', title, message });
};

export const showError = (message: string, title = 'Error') => {
  const { addNotification } = useNotificationStore.getState();
  addNotification({ type: 'error', title, message });
};

export const showWarning = (message: string, title = 'Advertencia') => {
  const { addNotification } = useNotificationStore.getState();
  addNotification({ type: 'warning', title, message });
};

export const showInfo = (message: string, title = 'Información') => {
  const { addNotification } = useNotificationStore.getState();
  addNotification({ type: 'info', title, message });
};

// Para casos especiales donde necesitamos confirmación
export const showConfirm = (
  message: string,
  onConfirm: () => void,
  _onCancel?: () => void,
  title = 'Confirmar Acción'
) => {
  const { addNotification } = useNotificationStore.getState();
  
  addNotification({
    type: 'warning',
    title,
    message,
    duration: 0, // No auto-remove
    action: {
      label: 'Confirmar',
      onClick: () => {
        onConfirm();
        // Remove notification after confirmation
        const notifications = useNotificationStore.getState().notifications;
        const lastNotification = notifications[notifications.length - 1];
        if (lastNotification) {
          useNotificationStore.getState().removeNotification(lastNotification.id);
        }
      },
    },
  });
};
