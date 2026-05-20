"""
Servicio de APM (Application Performance Monitoring) y Error Tracking
Implementación de monitoreo de rendimiento y seguimiento de errores
"""

import time
import traceback
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from functools import wraps
from contextlib import asynccontextmanager
import asyncio
import psutil
import logging

from fastapi import Request, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings


class APMService:
    """Servicio principal de APM y Error Tracking"""
    
    def __init__(self):
        self.settings = get_settings()
        self.enabled = getattr(self.settings, 'APM_ENABLED', True)
        self.service_name = getattr(self.settings, 'APM_SERVICE_NAME', 'motostock')
        self.environment = getattr(self.settings, 'APM_ENVIRONMENT', 'production')
        self.sample_rate = getattr(self.settings, 'APM_SAMPLE_RATE', 1.0)
        
        # Métricas en memoria
        self.metrics = {
            'requests': {},
            'errors': {},
            'performance': {},
            'system': {}
        }
        
        # Configuración de logging
        self.logger = logging.getLogger('apm')
        self.logger.setLevel(logging.INFO)
        
        # Handler personalizado para APM
        if self.enabled:
            self._setup_apm_handler()
    
    def _setup_apm_handler(self):
        """Configura handler personalizado para logging APM"""
        handler = APMHandler(self)
        handler.setLevel(logging.INFO)
        self.logger.addHandler(handler)
    
    def track_request(self, request: Request, response_status: int, duration: float):
        """Rastrea una petición HTTP"""
        if not self.enabled:
            return
        
        try:
            # Generar ID único para la petición
            request_id = str(uuid.uuid4())
            
            # Extraer información de la petición
            endpoint = request.url.path
            method = request.method
            user_agent = request.headers.get('user-agent', 'unknown')
            ip_address = request.client.host if request.client else 'unknown'
            
            # Métricas de la petición
            request_metrics = {
                'request_id': request_id,
                'timestamp': datetime.utcnow().isoformat(),
                'method': method,
                'endpoint': endpoint,
                'status_code': response_status,
                'duration_ms': duration * 1000,
                'user_agent': user_agent,
                'ip_address': ip_address,
                'content_length': getattr(request, 'content_length', 0),
                'query_params': dict(request.query_params),
                'headers': dict(request.headers),
                'environment': self.environment,
                'service': self.service_name
            }
            
            # Almacenar métricas
            self._store_metric('requests', endpoint, request_metrics)
            
            # Log estructurado
            self.logger.info(json.dumps({
                'type': 'request',
                'data': request_metrics
            }))
            
        except Exception as e:
            self.logger.error(f"Error tracking request: {e}")
    
    def track_error(self, error: Exception, request: Optional[Request] = None, context: Dict[str, Any] = None):
        """Rastrea un error"""
        if not self.enabled:
            return
        
        try:
            error_id = str(uuid.uuid4())
            
            # Extraer información del error
            error_type = type(error).__name__
            error_message = str(error)
            error_traceback = traceback.format_exc()
            
            # Información del request si está disponible
            request_info = {}
            if request:
                request_info = {
                    'method': request.method,
                    'endpoint': request.url.path,
                    'query_params': dict(request.query_params),
                    'headers': dict(request.headers),
                    'ip_address': request.client.host if request.client else 'unknown'
                }
            
            # Métricas del error
            error_metrics = {
                'error_id': error_id,
                'timestamp': datetime.utcnow().isoformat(),
                'error_type': error_type,
                'error_message': error_message,
                'stack_trace': error_traceback,
                'request': request_info,
                'context': context or {},
                'environment': self.environment,
                'service': self.service_name
            }
            
            # Almacenar métricas
            self._store_metric('errors', error_type, error_metrics)
            
            # Log estructurado
            self.logger.error(json.dumps({
                'type': 'error',
                'data': error_metrics
            }))
            
        except Exception as e:
            self.logger.error(f"Error tracking error: {e}")
    
    def track_performance(self, operation: str, duration: float, metadata: Dict[str, Any] = None):
        """Rastrea métricas de rendimiento"""
        if not self.enabled:
            return
        
        try:
            performance_id = str(uuid.uuid4())
            
            # Métricas de rendimiento
            performance_metrics = {
                'performance_id': performance_id,
                'timestamp': datetime.utcnow().isoformat(),
                'operation': operation,
                'duration_ms': duration * 1000,
                'metadata': metadata or {},
                'environment': self.environment,
                'service': self.service_name
            }
            
            # Almacenar métricas
            self._store_metric('performance', operation, performance_metrics)
            
            # Log estructurado
            self.logger.info(json.dumps({
                'type': 'performance',
                'data': performance_metrics
            }))
            
        except Exception as e:
            self.logger.error(f"Error tracking performance: {e}")
    
    def track_system_metrics(self):
        """Rastrea métricas del sistema"""
        if not self.enabled:
            return
        
        try:
            # Métricas del sistema
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            network = psutil.net_io_counters()
            
            system_metrics = {
                'timestamp': datetime.utcnow().isoformat(),
                'cpu': {
                    'percent': cpu_percent,
                    'count': psutil.cpu_count()
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'percent': memory.percent,
                    'used': memory.used
                },
                'disk': {
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': (disk.used / disk.total) * 100
                },
                'network': {
                    'bytes_sent': network.bytes_sent,
                    'bytes_recv': network.bytes_recv,
                    'packets_sent': network.packets_sent,
                    'packets_recv': network.packets_recv
                },
                'environment': self.environment,
                'service': self.service_name
            }
            
            # Almacenar métricas
            self._store_metric('system', 'current', system_metrics)
            
            # Log estructurado
            self.logger.info(json.dumps({
                'type': 'system',
                'data': system_metrics
            }))
            
        except Exception as e:
            self.logger.error(f"Error tracking system metrics: {e}")
    
    def _store_metric(self, metric_type: str, key: str, data: Dict[str, Any]):
        """Almacena métricas en memoria"""
        if metric_type not in self.metrics:
            self.metrics[metric_type] = {}
        
        if key not in self.metrics[metric_type]:
            self.metrics[metric_type][key] = []
        
        self.metrics[metric_type][key].append(data)
        
        # Mantener solo las últimas 1000 métricas por tipo/key
        if len(self.metrics[metric_type][key]) > 1000:
            self.metrics[metric_type][key] = self.metrics[metric_type][key][-1000:]
    
    def get_metrics_summary(self, metric_type: str = None, time_window: int = 3600) -> Dict[str, Any]:
        """Obtiene resumen de métricas"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(seconds=time_window)
            summary = {}
            
            if metric_type:
                if metric_type in self.metrics:
                    summary[metric_type] = self._summarize_metric_type(
                        self.metrics[metric_type], cutoff_time
                    )
            else:
                for m_type, m_data in self.metrics.items():
                    summary[m_type] = self._summarize_metric_type(m_data, cutoff_time)
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Error getting metrics summary: {e}")
            return {}
    
    def _summarize_metric_type(self, metric_data: Dict[str, List], cutoff_time: datetime) -> Dict[str, Any]:
        """Resume un tipo específico de métricas"""
        summary = {}
        
        for key, values in metric_data.items():
            if not values:
                continue
            
            # Filtrar por tiempo
            recent_values = [
                v for v in values 
                if datetime.fromisoformat(v['timestamp']) > cutoff_time
            ]
            
            if not recent_values:
                continue
            
            # Calcular estadísticas básicas
            if key == 'requests':
                summary[key] = self._summarize_requests(recent_values)
            elif key == 'errors':
                summary[key] = self._summarize_errors(recent_values)
            elif key == 'performance':
                summary[key] = self._summarize_performance(recent_values)
            elif key == 'system':
                summary[key] = self._summarize_system(recent_values)
        
        return summary
    
    def _summarize_requests(self, requests: List[Dict]) -> Dict[str, Any]:
        """Resume métricas de peticiones"""
        if not requests:
            return {}
        
        total_requests = len(requests)
        successful_requests = len([r for r in requests if 200 <= r['status_code'] < 400])
        error_requests = len([r for r in requests if r['status_code'] >= 400])
        
        durations = [r['duration_ms'] for r in requests if 'duration_ms' in r]
        avg_duration = sum(durations) / len(durations) if durations else 0
        max_duration = max(durations) if durations else 0
        min_duration = min(durations) if durations else 0
        
        # Agrupar por endpoint
        endpoints = {}
        for r in requests:
            endpoint = r['endpoint']
            if endpoint not in endpoints:
                endpoints[endpoint] = {'count': 0, 'errors': 0, 'duration_sum': 0}
            endpoints[endpoint]['count'] += 1
            if r['status_code'] >= 400:
                endpoints[endpoint]['errors'] += 1
            if 'duration_ms' in r:
                endpoints[endpoint]['duration_sum'] += r['duration_ms']
        
        return {
            'total_requests': total_requests,
            'successful_requests': successful_requests,
            'error_requests': error_requests,
            'success_rate': (successful_requests / total_requests) * 100 if total_requests > 0 else 0,
            'error_rate': (error_requests / total_requests) * 100 if total_requests > 0 else 0,
            'avg_duration_ms': avg_duration,
            'max_duration_ms': max_duration,
            'min_duration_ms': min_duration,
            'endpoints': endpoints
        }
    
    def _summarize_errors(self, errors: List[Dict]) -> Dict[str, Any]:
        """Resume métricas de errores"""
        if not errors:
            return {}
        
        total_errors = len(errors)
        
        # Agrupar por tipo de error
        error_types = {}
        for e in errors:
            error_type = e['error_type']
            if error_type not in error_types:
                error_types[error_type] = 0
            error_types[error_type] += 1
        
        # Agrupar por endpoint
        endpoints = {}
        for e in errors:
            if 'request' in e and 'endpoint' in e['request']:
                endpoint = e['request']['endpoint']
                if endpoint not in endpoints:
                    endpoints[endpoint] = 0
                endpoints[endpoint] += 1
        
        return {
            'total_errors': total_errors,
            'error_types': error_types,
            'endpoints': endpoints
        }
    
    def _summarize_performance(self, performance: List[Dict]) -> Dict[str, Any]:
        """Resume métricas de rendimiento"""
        if not performance:
            return {}
        
        # Agrupar por operación
        operations = {}
        for p in performance:
            operation = p['operation']
            if operation not in operations:
                operations[operation] = {
                    'count': 0,
                    'duration_sum': 0,
                    'min_duration': float('inf'),
                    'max_duration': 0
                }
            
            operations[operation]['count'] += 1
            if 'duration_ms' in p:
                duration = p['duration_ms']
                operations[operation]['duration_sum'] += duration
                operations[operation]['min_duration'] = min(operations[operation]['min_duration'], duration)
                operations[operation]['max_duration'] = max(operations[operation]['max_duration'], duration)
        
        # Calcular promedios
        for op, data in operations.items():
            if data['count'] > 0:
                data['avg_duration'] = data['duration_sum'] / data['count']
                if data['min_duration'] == float('inf'):
                    data['min_duration'] = 0
        
        return operations
    
    def _summarize_system(self, system: List[Dict]) -> Dict[str, Any]:
        """Resume métricas del sistema"""
        if not system:
            return {}
        
        latest = system[-1]  # Usar la medición más reciente
        
        return {
            'cpu': latest.get('cpu', {}),
            'memory': latest.get('memory', {}),
            'disk': latest.get('disk', {}),
            'network': latest.get('network', {}),
            'timestamp': latest.get('timestamp')
        }


class APMHandler(logging.Handler):
    """Handler personalizado para logging APM"""
    
    def __init__(self, apm_service: APMService):
        super().__init__()
        self.apm_service = apm_service
    
    def emit(self, record):
        """Emite log al servicio APM"""
        try:
            # Parsear el mensaje JSON
            message = record.getMessage()
            if message.startswith('{') and message.endswith('}'):
                data = json.loads(message)
                
                # Procesar según tipo
                if data.get('type') == 'request':
                    self.apm_service._store_metric('requests', 
                        data['data']['endpoint'], data['data'])
                elif data.get('type') == 'error':
                    self.apm_service._store_metric('errors',
                        data['data']['error_type'], data['data'])
                elif data.get('type') == 'performance':
                    self.apm_service._store_metric('performance',
                        data['data']['operation'], data['data'])
                elif data.get('type') == 'system':
                    self.apm_service._store_metric('system',
                        'current', data['data'])
        
        except Exception:
            # Ignorar errores en el handler para evitar recursión
            pass


# Instancia global del servicio APM
apm_service = APMService()


# Decoradores para tracking automático
def track_request(func):
    """Decorador para tracking automático de peticiones"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if not apm_service.enabled:
            return await func(*args, **kwargs)
        
        start_time = time.time()
        request = None
        
        # Buscar request en los argumentos
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break
        
        try:
            result = await func(*args, **kwargs)
            
            # Obtener status code del resultado
            status_code = 200
            if hasattr(result, 'status_code'):
                status_code = result.status_code
            elif isinstance(result, HTTPException):
                status_code = result.status_code
            
            duration = time.time() - start_time
            
            # Track request
            apm_service.track_request(request, status_code, duration)
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            
            # Track error
            apm_service.track_error(e, request)
            
            # Track request con error
            status_code = getattr(e, 'status_code', 500)
            apm_service.track_request(request, status_code, duration)
            
            raise
    
    return wrapper


def track_performance(operation: str, metadata: Dict[str, Any] = None):
    """Decorador para tracking automático de rendimiento"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not apm_service.enabled:
                return await func(*args, **kwargs)
            
            start_time = time.time()
            
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                
                # Track performance
                apm_service.track_performance(operation, duration, metadata)
                
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                
                # Track error en performance
                apm_service.track_error(e, context={'operation': operation, 'duration': duration})
                apm_service.track_performance(operation, duration, metadata)
                
                raise
        
        return wrapper
    return decorator


@asynccontextmanager
async def track_operation(operation: str, metadata: Dict[str, Any] = None):
    """Context manager para tracking de operaciones"""
    if not apm_service.enabled:
        yield
        return
    
    start_time = time.time()
    
    try:
        yield
        duration = time.time() - start_time
        
        # Track performance exitoso
        apm_service.track_performance(operation, duration, metadata)
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Track error en operación
        apm_service.track_error(e, context={'operation': operation, 'duration': duration})
        apm_service.track_performance(operation, duration, metadata)
        
        raise


# Funciones helper para uso en otras partes del código
def track_custom_error(error: Exception, context: Dict[str, Any] = None):
    """Función helper para tracking de errores personalizados"""
    apm_service.track_error(error, context=context)


def get_apm_metrics(metric_type: str = None, time_window: int = 3600) -> Dict[str, Any]:
    """Obtiene métricas APM"""
    return apm_service.get_metrics_summary(metric_type, time_window)


def start_system_metrics_monitoring():
    """Inicia monitoreo de métricas del sistema"""
    async def monitor_system():
        while True:
            try:
                apm_service.track_system_metrics()
                await asyncio.sleep(60)  # Cada minuto
            except Exception as e:
                logging.error(f"Error in system monitoring: {e}")
                await asyncio.sleep(60)
    
    # Iniciar tarea en background
    asyncio.create_task(monitor_system())


# Middleware para FastAPI
class APMiddleware:
    """Middleware para APM en FastAPI"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Crear request object
        request = Request(scope, receive)
        
        # Iniciar tracking
        start_time = time.time()
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                # Obtener status code
                status_code = message.get("status", 200)
                
                # Track request
                duration = time.time() - start_time
                apm_service.track_request(request, status_code, duration)
            
            await send(message)
        
        await self.app(scope, receive, send_wrapper)
