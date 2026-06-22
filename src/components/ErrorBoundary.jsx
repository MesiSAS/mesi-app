import { Component } from 'react';

// Evita que un error de render deje la app en blanco: muestra un fallback
// con la opcion de recargar o volver al inicio, y loguea el error.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturo:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] p-6">
          <div className="bg-white rounded-3xl shadow-sm p-8 max-w-md text-center">
            <h1 className="text-xl font-bold text-[#0A353F] mb-2">Algo salio mal</h1>
            <p className="text-gray-500 text-sm mb-6">
              Ocurrio un error al mostrar esta vista. Puedes recargar o volver al inicio.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-[#0A353F] text-white text-sm font-semibold"
              >
                Recargar
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="px-4 py-2 rounded-xl bg-gray-100 text-[#0A353F] text-sm font-semibold"
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
