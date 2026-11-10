import { cloneElement, Component, isValidElement } from "react";

export default class FeatureErrorBoundary extends Component {
  state = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error(`The ${this.props.name} feature failed to render:`, error, info);
  }

  render() {
    if (!this.state.hasError) {
      return isValidElement(this.props.children)
        ? cloneElement(this.props.children, { key: this.state.retryKey })
        : this.props.children;
    }

    return (
      <section
        className="m-4 rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm"
        role="alert"
      >
        <h2 className="text-sm font-bold text-slate-900">
          {this.props.name} is temporarily unavailable
        </h2>
        <p className="mt-2 text-xs text-slate-600">
          Other parts of TimeCloud are still available. Try loading this feature
          again.
        </p>
        <button
          type="button"
          onClick={() =>
            this.setState((state) => ({
              hasError: false,
              retryKey: state.retryKey + 1,
            }))
          }
          className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
        >
          Try again
        </button>
      </section>
    );
  }
}
