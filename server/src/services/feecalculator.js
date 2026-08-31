export function calculateFees(items) {
    const subtotal = items.reduce((Sum, item) => Sum + item.unitPrice * item.quantity, 0);
    const deliveryFee = 400
    const serviceFee = Math.round(subtotal * 0.05)
    const totalAmount = serviceFee + deliveryFee + subtotal 
    
    return {
        
        subtotal,
        deliveryFee,
        serviceFee,
        totalAmount
    }
}