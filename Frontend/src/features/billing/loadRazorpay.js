// Razorpay Checkout is a script Razorpay hosts (card details go straight to
// them, never through our servers). It's only fetched when someone pays.
const SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loading = null;

/** Resolves to window.Razorpay, adding the script once. */
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay didn't load")));
    script.onerror = () => {
      loading = null; // let the next attempt try again
      script.remove();
      reject(new Error("Razorpay didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
