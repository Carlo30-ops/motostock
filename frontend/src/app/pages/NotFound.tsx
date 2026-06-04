import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 p-4 text-center">
      <h1 className="text-9xl font-black text-gray-200">404</h1>
      <p className="mt-4 text-2xl font-bold text-gray-800 md:text-3xl">Página no encontrada</p>
      <p className="mt-4 text-gray-500">Lo sentimos, la página que buscas no existe o ha sido movida.</p>
      <Link
        to="/"
        className="mt-8 rounded bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90 focus:outline-none focus:ring"
      >
        Volver al Inicio
      </Link>
    </div>
  );
}
