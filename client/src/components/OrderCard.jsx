import { useNavigate } from "react-router-dom";

export const STATUS = {
  PENDING_PAYMENT: { label: "Pending Payment", color: "bg-amber-100 text-amber-700", icon: "hourglass_empty" },
  PENDING_RESTAURANT_CONFIRMATION: { label: "Awaiting Confirm", color: "bg-blue-100 text-blue-700", icon: "check_circle" },
  PREPARING: { label: "Preparing", color: "bg-orange-100 text-orange-700", icon: "cooking" },
  OUT_FOR_DELIVERY: { label: "On the Way", color: "bg-purple-100 text-purple-700", icon: "local_shipping" },
  DELIVERED: { label: "Delivered", color: "bg-green-100 text-green-700", icon: "done_all" },
  CANCELLED: { label: "Cancelled", color: "bg-slate-100 text-slate-500", icon: "cancel" },
};

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const formatTime = (dateString) =>
  new Date(dateString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const OrderCard = ({ order }) => {
  const navigate = useNavigate();
  const status = STATUS[order.status] || STATUS.PENDING_PAYMENT;

  return (
    <article
      onClick={() => navigate(`/orders/${order.id}`)}
      className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition cursor-pointer"
    >
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-amber-500">storefront</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{order.restaurant?.name || "Restaurant"}</h3>
            <p className="text-xs text-slate-400">{formatDate(order.createdAt)} · {formatTime(order.createdAt)}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full ${status.color}`}>
          <span className="material-symbols-outlined text-sm">{status.icon}</span>
          {status.label}
        </span>
      </div>

      <div className="border-t border-slate-50 px-5 py-3 space-y-1.5">
        {order.orderItems?.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              {item.quantity}× {item.menuItem?.name || `Item #${item.menuItemId}`}
            </span>
            <span className="text-slate-400 text-xs">₦{(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-50 px-5 py-3 flex items-center justify-between bg-slate-50/30">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="material-symbols-outlined text-sm">location_on</span>
          <span className="truncate max-w-[180px]">{order.deliveryAddress}</span>
        </div>
        <span className="text-sm font-bold text-slate-900">₦{Number(order.totalAmount).toLocaleString()}</span>
      </div>
    </article>
  );
};

export default OrderCard;
