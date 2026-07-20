export function calculateFees(items) {
    const subtotal = items.reduce((Sum, item) => Sum + item.unitPrice * item.quantity, 0);
    const deliveryFee = 500
    const serviceFee = 300
    const tax = Math.round(subtotal * 0.075)
    const totalAmount = serviceFee + deliveryFee + tax + subtotal 
    
    return {
        
        subtotal,
        deliveryFee,
        serviceFee,
        tax,
        totalAmount
    }
}