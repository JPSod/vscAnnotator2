try {
  paypal.Buttons().render("#paypal-button-container");
} catch (error) {
  console.error("Failed to render the PayPal Buttons", error);
}