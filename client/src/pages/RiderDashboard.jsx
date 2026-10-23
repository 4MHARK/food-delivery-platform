import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout, { RIDER_NAV } from "../components/AppLayout";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { useSSE } from "../hooks/useSSE";
import { useNotificationPermission, notify } from "../hooks/useNotifications";
import DeliveryMap from "../components/DeliveryMap";
import { getCurrentPosition } from "../lib/geo";

const ORDER_STATUS = {
  PENDING_PAYMENT: {
    label: "Pending Payment",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  PENDING_RESTAURANT_CONFIRMATION: {
    label: "Awaiting Confirm",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  ACCEPTED: {
    label: "Accepted",
    color: "bg-teal-100 text-teal-700 border-teal-200",
    dot: "bg-teal-500",
  },
  PREPARING: {
    label: "Preparing",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  READY_FOR_PICKUP: {
    label: "Ready for Pickup",
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
  },
  OUT_FOR_DELIVERY: {
    label: "On the Way",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  DELIVERED: {
    label: "Delivered",
    color: "bg-green-100 text-green-700 border-green-200",
    dot: "bg-green-500",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
};

const DELIVERY_STATUS = {
  ZILLA_ON_IT: {
    label: "Zilla On It",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  AT_KITCHEN: {
    label: "At Kitchen",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-500",
  },
  BAGGED: {
    label: "Bagged",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  MOVING: {
    label: "Moving",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  CLOSE_BY: {
    label: "Close By",
    color: "bg-pink-100 text-pink-700 border-pink-200",
    dot: "bg-pink-500",
  },
  DELIVERED: {
    label: "Delivered",
    color: "bg-green-100 text-green-700 border-green-200",
    dot: "bg-green-500",
  },
  FAILED: {
    label: "Failed",
    color: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

// Ordered milestones for the progress bar. DELIVERY_STATUS also holds FAILED,
// which is not a step on the happy path.
const DELIVERY_STEPS = [
  { key: "ZILLA_ON_IT", label: "Assigned" },
  { key: "AT_KITCHEN", label: "At Kitchen" },
  { key: "BAGGED", label: "Picked Up" },
  { key: "MOVING", label: "Moving" },
  { key: "CLOSE_BY", label: "Close By" },
  { key: "DELIVERED", label: "Delivered" },
];

function DeliveryProgress({ status }) {
  const index = DELIVERY_STEPS.findIndex((step) => step.key === status);
  const pct =
    index < 0
      ? 0
      : Math.round((index / (DELIVERY_STEPS.length - 1)) * 100);

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Delivery progress
        </span>
        <span className="text-[11px] font-bold text-amber-700">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Delivery progress"
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-medium text-slate-500">
        <span>{DELIVERY_STEPS[0].label}</span>
        <span>{DELIVERY_STEPS[DELIVERY_STEPS.length - 1].label}</span>
      </div>
    </div>
  );
}

const ACTIVE_DELIVERY_STATUSES = [
  "ZILLA_ON_IT",
  "AT_KITCHEN",
  "BAGGED",
  "MOVING",
  "CLOSE_BY",
];
const PAST_DELIVERY_STATUSES = ["DELIVERED", "FAILED"];
// Once the food is picked up, the server requires a written failure reason.
const FAIL_REASON_REQUIRED_STATUSES = ["BAGGED", "MOVING", "CLOSE_BY"];
const FAIL_REASON_MIN_LENGTH = 5;

const ETA_RANGES = {
  Bicycle: [20, 35],
  Motorcycle: [10, 25],
  Car: [10, 20],
};
const DEFAULT_ETA = [10, 30];

// Some profiles have an email in the phone field. Link it correctly instead
// of rendering a mailto address behind a telephone icon.
const isEmail = (value) =>
  typeof value === "string" && value.includes("@");

function estimateETA(vehicleType, deliveryStatus) {
  const [low, high] = ETA_RANGES[vehicleType] || DEFAULT_ETA;
  const totalSteps =
    Object.keys(DELIVERY_STATUS).filter((k) => k !== "FAILED").length - 1;
  const progress = Object.keys(DELIVERY_STATUS).indexOf(deliveryStatus);
  const factor = Math.max(0, 1 - progress / Math.max(1, totalSteps));
  return [
    Math.max(1, Math.round(low * factor)),
    Math.max(2, Math.round(high * factor)),
  ];
}

const MAX_PHOTO_DIM = 600;
const ITEMS_PER_PAGE = 10;

function readAndResizePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const scale = Math.min(
          1,
          MAX_PHOTO_DIM / Math.max(img.width, img.height)
        );
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const RiderDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "deliveries";
  const { user } = useAuth();

  // Sub-tab inside "Deliveries" tab: "available" | "active"
  const [dispatchView, setDispatchView] = useState("available");

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rider, setRider] = useState(null);

  // Registration form
  const [riderForm, setRiderForm] = useState({
    vehicleType: "",
    licensePlate: "",
    licenseNumber: "",
    matricNumber: "",
    phone: "",
    campusId: "",
  });
  const [idType, setIdType] = useState("license");
  const [registering, setRegistering] = useState(false);
  const [photo, setPhoto] = useState("");
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [campuses, setCampuses] = useState([]);

  // Profile management after registration
  const [profileForm, setProfileForm] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [profileIdType, setProfileIdType] = useState("license");
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [processingProfilePhoto, setProcessingProfilePhoto] = useState(false);

  // Orders & deliveries
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myDeliveries, setMyDeliveries] = useState([]);
  const [failures, setFailures] = useState([]);
  const [stats, setStats] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  // Per-row loading
  const [acceptingOrderId, setAcceptingOrderId] = useState(null);
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  // FAILED confirmation dialog
  const [failTarget, setFailTarget] = useState(null);
  const [failReason, setFailReason] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("");

  // Handoff location verification
  const [locating, setLocating] = useState(false);
  const [locationTarget, setLocationTarget] = useState(null); // { deliveryId, newStatus, extra }
  const [locationReason, setLocationReason] = useState("");

  // Bank / payouts
  const [bankForm, setBankForm] = useState({
    accountNumber: "",
    bankCode: "",
    bankName: "",
  });
  const [savingBank, setSavingBank] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resolvedName, setResolvedName] = useState(null);
  const [editingBank, setEditingBank] = useState(false);
  const [banks, setBanks] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // History filter, search & pagination
  const [historyFilter, setHistoryFilter] = useState("ALL");
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  // Reviews filter, search & pagination (solves the 400+ reviews scroll issue)
  const [reviewStarFilter, setReviewStarFilter] = useState("ALL");
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewPage, setReviewPage] = useState(1);

  // Toast
  const [message, setMessage] = useState("");
  const messageTimer = useRef(null);

  // Polling refs
  const prevAvailableRef = useRef(0);
  const prevReviewCountRef = useRef(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  const showMsg = (msg) => {
    setMessage(msg);
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(""), 8000);
  };

  // Derive active & past deliveries
  const activeDelivery =
    myDeliveries.find((d) => ACTIVE_DELIVERY_STATUSES.includes(d.status)) ||
    null;
  const pastDeliveries = useMemo(
    () => myDeliveries.filter((d) => PAST_DELIVERY_STATUSES.includes(d.status)),
    [myDeliveries]
  );
  const failNeedsReason =
    Boolean(failTarget) &&
    activeDelivery?.id === failTarget &&
    FAIL_REASON_REQUIRED_STATUSES.includes(activeDelivery.status);

  // Automatically switch to "My Delivery" sub-tab if rider has an active delivery on first load
  const hasAutoSwitchedRef = useRef(false);
  useEffect(() => {
    if (activeDelivery && !hasAutoSwitchedRef.current) {
      setDispatchView("active");
      hasAutoSwitchedRef.current = true;
    }
  }, [activeDelivery]);

  // Reset the editable profile fields from the saved rider. Used on load, on
  // entering the Profile tab, on Edit, and on Cancel.
  const resetProfileForm = (riderData) => {
    if (!riderData) return;
    setProfileForm({
      vehicleType: riderData.vehicleType || "",
      phone: riderData.user?.phone || "",
      campusId: riderData.campusId ? String(riderData.campusId) : "",
      licensePlate: riderData.licensePlate || "",
      licenseNumber: riderData.licenseNumber || "",
      matricNumber: riderData.matricNumber || "",
    });
    setProfilePhoto(riderData.photoUrl || "");
    // Derive the ID tab from what was actually saved, so an unsaved toggle
    // cannot survive a tab switch or a cancel.
    setProfileIdType(riderData.matricNumber ? "matric" : "license");
  };

  // ── Fetch rider profile ──
  const fetchRider = async () => {
    try {
      const data = await api.get("/riders/me");
      setRider(data.rider);
      resetProfileForm(data.rider);
      setBankForm({
        accountNumber: data.rider.accountNumber || "",
        bankCode: data.rider.bankCode || "",
        bankName: data.rider.bankName || "",
      });
      setResolvedName(data.rider.accountName || null);
    } catch (e) {
      if (e?.status === 404) {
        setRider(null);
        return;
      }
      setError("Failed to load rider profile.");
    }
  };

  // ── Fetch available orders and my deliveries ──
  const fetchData = async (opts = {}) => {
    const { silent = false } = opts;
    try {
      if (!silent) {
        setDataLoading(true);
        setDataError("");
      }

      const [ordersRes, deliveriesRes, statsRes, failuresRes] = await Promise.all([
        api.get("/riders/available-orders").catch(() => null),
        api.get("/riders/my-deliveries").catch(() => null),
        api.get("/riders/stats").catch(() => null),
        api.get("/riders/failures").catch(() => null),
      ]);

      let nextAvailable = [];
      if (ordersRes) {
        nextAvailable = ordersRes.orders || [];
        setAvailableOrders(nextAvailable);
      }
      if (deliveriesRes) {
        setMyDeliveries(deliveriesRes.deliveries || []);
      }
      if (statsRes) {
        setStats(statsRes.stats);
      }
      if (failuresRes) {
        setFailures(failuresRes.failures || []);
      }

      setLastUpdated(new Date());
      return { availableOrders: nextAvailable };
    } catch {
      if (!silent) setDataError("Failed to load data.");
      return null;
    } finally {
      if (!silent) setDataLoading(false);
    }
  };

  // ── Choose + resize a profile photo ──
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showMsg("Please choose an image file.");
      return;
    }
    try {
      setProcessingPhoto(true);
      setPhoto(await readAndResizePhoto(file));
    } catch {
      showMsg("Could not process that photo. Try a different image.");
    } finally {
      setProcessingPhoto(false);
    }
  };

  // ── Profile photo after registration ──
  const handleProfilePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showMsg("Please choose an image file.");
      return;
    }
    try {
      setProcessingProfilePhoto(true);
      setProfilePhoto(await readAndResizePhoto(file));
    } catch {
      showMsg("Could not process that photo. Try a different image.");
    } finally {
      setProcessingProfilePhoto(false);
    }
  };

  const handleEditProfile = () => {
    if (!rider) return;
    resetProfileForm(rider);
    setEditingProfile(true);
  };

  const handleCancelProfile = () => {
    resetProfileForm(rider);
    setEditingProfile(false);
  };

  // ── Save profile changes ──
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm || !rider) return;

    if (!profileForm.vehicleType) { showMsg("Select a vehicle type."); return; }
    if (!profileForm.phone) { showMsg("Enter your phone number."); return; }
    if (!profileForm.campusId) { showMsg("Select your campus."); return; }
    if (profileIdType === "license" && (!profileForm.licensePlate || !profileForm.licenseNumber)) {
      showMsg("Enter both the license plate and license number.");
      return;
    }
    if (profileIdType === "matric" && !profileForm.matricNumber) {
      showMsg("Enter your matric number.");
      return;
    }

    try {
      setSavingProfile(true);
      const body = {
        vehicleType: profileForm.vehicleType,
        phone: profileForm.phone,
        campusId: Number(profileForm.campusId),
        // Clear the unused identification method so switching works; the
        // server validates the final combination.
        licensePlate: null,
        licenseNumber: null,
        matricNumber: null,
      };
      if (profileIdType === "license") {
        body.licensePlate = profileForm.licensePlate;
        body.licenseNumber = profileForm.licenseNumber;
      } else {
        body.matricNumber = profileForm.matricNumber;
      }
      if (profilePhoto && profilePhoto !== rider.photoUrl) {
        body.photo = profilePhoto;
      }

      const data = await api.put("/riders/me", body);
      setRider((prev) => ({ ...prev, ...data.rider }));
      resetProfileForm(data.rider);
      setEditingProfile(false);
      // The server explains when an identity/campus change reset verification.
      showMsg(data.message || "Profile updated.");
      // Campus/availability changes affect which orders this rider sees.
      fetchData();
    } catch (e) {
      showMsg(e.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Register rider profile ──
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!riderForm.vehicleType || !riderForm.phone) {
      showMsg("Please fill in vehicle type and phone.");
      return;
    }
    if (!riderForm.campusId) {
      showMsg("Please choose your campus.");
      return;
    }
    if (!photo) {
      showMsg("Please add a profile photo of yourself.");
      return;
    }
    if (
      idType === "license" &&
      (!riderForm.licensePlate || !riderForm.licenseNumber)
    ) {
      showMsg("Please fill in license plate and license number.");
      return;
    }
    if (idType === "matric" && !riderForm.matricNumber) {
      showMsg("Please fill in your matriculation number.");
      return;
    }
    try {
      setRegistering(true);
      const body = {
        vehicleType: riderForm.vehicleType,
        phone: riderForm.phone,
        campusId: riderForm.campusId,
        photo,
      };
      if (idType === "license") {
        body.licensePlate = riderForm.licensePlate;
        body.licenseNumber = riderForm.licenseNumber;
      } else {
        body.matricNumber = riderForm.matricNumber;
      }

      const data = await api.post("/riders/register", body);
      setRider(data.rider);
      showMsg("Rider profile created! 🎉");
    } catch (e) {
      showMsg(e.message || "Something went wrong. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  // ── Accept delivery ──
  const handleAccept = async (orderId) => {
    try {
      setAcceptingOrderId(orderId);
      await api.post(`/deliveries/${orderId}/accept`);
      showMsg(`Order #${orderId} accepted!`);
      await fetchData();
      setDispatchView("active"); // Jump straight to active delivery view
    } catch (e) {
      showMsg(e.message || "Something went wrong. Please try again.");
    } finally {
      setAcceptingOrderId(null);
    }
  };

  // ── Reject / skip an available order ──
  const handleReject = async (orderId) => {
    setAvailableOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      setRejectingOrderId(orderId);
      await api.post(`/riders/reject-order/${orderId}`);
    } catch {
      showMsg("Could not skip order. It may reappear on refresh.");
      await fetchData();
    } finally {
      setRejectingOrderId(null);
    }
  };

  // ── Update delivery status ──
  const handleUpdateDeliveryStatus = async (
    deliveryId,
    newStatus,
    extra = {}
  ) => {
    try {
      setUpdatingDeliveryId(deliveryId);
      const body = { status: newStatus, ...extra };
      await api.put(`/deliveries/${deliveryId}/status`, body);
      const label = DELIVERY_STATUS[newStatus]?.label || newStatus;
      showMsg(`Delivery status updated to "${label}"`);
      await fetchData();
      if (newStatus === "DELIVERED" || newStatus === "FAILED") {
        setDispatchView("available");
      }
    } catch (e) {
      // A soft proximity failure needs a reason; the retry will carry it.
      if (
        e?.status === 422 &&
        e.data?.requiresReason &&
        !extra.locationUnverifiedReason
      ) {
        setLocationTarget({ deliveryId, newStatus, extra });
        setLocationReason("");
        showMsg(e.message || "Add a reason to continue.");
        return;
      }

      showMsg(e.message || "Something went wrong. Please try again.");
      // A wrong-code release (429) or an undeliverable order (409) changes
      // server state underneath us — resync so the active card disappears.
      if (e?.status === 429 || e?.status === 409) {
        await fetchData({ silent: true });
        setDispatchView("available");
      }
    } finally {
      setUpdatingDeliveryId(null);
    }
  };

  // CLOSE_BY and DELIVERED need a fresh location reading. If the device can't
  // provide one, the rider must give a reason and the server flags the delivery.
  const handleHandoffStatus = async (deliveryId, newStatus, extra = {}) => {
    if (locating) return;
    setLocating(true);
    try {
      const position = await getCurrentPosition();
      await handleUpdateDeliveryStatus(deliveryId, newStatus, {
        ...extra,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        capturedAt: position.capturedAt,
      });
    } catch (e) {
      if (e?.name === "GeoError") {
        setLocationTarget({ deliveryId, newStatus, extra });
        setLocationReason("");
        showMsg(e.message);
      } else {
        showMsg(e?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLocating(false);
    }
  };

  const confirmLocationFallback = async () => {
    const target = locationTarget;
    const reason = locationReason.trim();
    if (!target || reason.length < 5) return;

    setLocationTarget(null);
    setLocationReason("");
    await handleUpdateDeliveryStatus(target.deliveryId, target.newStatus, {
      ...target.extra,
      locationUnverifiedReason: reason,
    });
  };

  // ── Deliver: require the customer's 4-digit code ──
  const handleDeliver = async (deliveryId) => {
    const code = deliveryCode.trim();
    if (!/^\d{4}$/.test(code)) {
      showMsg("Enter the 4-digit code from the customer.");
      return;
    }
    await handleHandoffStatus(deliveryId, "DELIVERED", { code });
    // Keep the code on screen if the handoff was blocked (location/reason).
  };

  // ── Confirm and execute FAILED ──
  const confirmFail = async () => {
    const deliveryId = failTarget;
    if (!deliveryId) return;

    const reason = failReason.trim();
    if (failNeedsReason && reason.length < FAIL_REASON_MIN_LENGTH) {
      showMsg("Add a short reason — the food has already been picked up.");
      return; // keep the dialog open so the rider can type one
    }

    setFailTarget(null);
    setFailReason("");
    await handleUpdateDeliveryStatus(
      deliveryId,
      "FAILED",
      reason ? { reason } : {}
    );
  };

  // ── Toggle availability ──
  const handleToggleAvailability = async () => {
    try {
      setTogglingAvailability(true);
      const newVal = !rider.isAvailable;
      const data = await api.put("/riders/me", { isAvailable: newVal });
      setRider((prev) => ({ ...prev, ...data.rider }));
      showMsg(
        newVal
          ? "You are now available for deliveries 🟢"
          : "You are now unavailable ⚫"
      );
    } catch (e) {
      showMsg(e.message || "Something went wrong. Please try again.");
    } finally {
      setTogglingAvailability(false);
    }
  };

  // ── Fetch payout history ──
  const fetchPayouts = async () => {
    try {
      setPayoutsLoading(true);
      const data = await api.get("/riders/payouts");
      setPayouts(data.payouts || []);
    } catch {
      /* silent */
    } finally {
      setPayoutsLoading(false);
    }
  };

  // ── Fetch my reviews ──
  const fetchReviews = async () => {
    if (!rider?.id) return;
    try {
      setReviewsLoading(true);
      const data = await api.get(`/riders/${rider.id}/reviews`);
      setReviews(data.reviews || []);
    } catch {
      /* silent */
    } finally {
      setReviewsLoading(false);
    }
  };

  // ── Save bank details ──
  const handleSaveBank = async (e) => {
    e.preventDefault();
    if (!bankForm.accountNumber || !bankForm.bankCode) {
      showMsg("Account number and bank code are required.");
      return;
    }
    try {
      setSavingBank(true);
      const data = await api.put("/riders/me/bank", bankForm);
      setRider((prev) => ({ ...prev, ...data.rider }));
      setEditingBank(false);
      showMsg(
        data.nameMismatch
          ? "Bank details saved, but the account name doesn't match your profile name. An admin will review them before payouts."
          : data.bankDetailsReviewRequired
            ? "Bank details saved. An admin will review them before payouts are sent."
            : "Bank details saved."
      );
    } catch (e) {
      showMsg(e.message || "Failed to save bank details.");
    } finally {
      setSavingBank(false);
    }
  };

  // ── Verify account number + bank ──
  const handleVerifyAccount = async () => {
    if (bankForm.accountNumber.length !== 10 || !bankForm.bankCode) {
      showMsg("Enter the 10-digit account number and pick a bank first.");
      return;
    }
    try {
      setVerifying(true);
      setResolvedName(null);
      const data = await api.get(
        `/payments/resolve-account?account_number=${bankForm.accountNumber}&bank_code=${bankForm.bankCode}`
      );
      setResolvedName(data.accountName);
      showMsg("Account verified.");
    } catch (e) {
      setResolvedName(null);
      showMsg(e.message || "Could not resolve account.");
    } finally {
      setVerifying(false);
    }
  };

  const fetchBanks = async () => {
    try {
      const data = await api.get("/payments/banks");
      setBanks(data.banks || []);
    } catch {
      setBanks([]);
    }
  };

  const fetchCampuses = async () => {
    try {
      const data = await api.get("/campuses", { auth: false });
      const list = data.campuses || [];
      setCampuses(list);
      // The account's campus wins; only campus-less accounts fall back to the
      // first one, and the server binds them to whichever they choose.
      const preferred = user?.campusId ?? list[0]?.id;
      setRiderForm((prev) =>
        prev.campusId || preferred == null
          ? prev
          : { ...prev, campusId: String(preferred) }
      );
    } catch {
      setCampuses([]);
    }
  };

  // ── Initial load ──
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      // Profile and dashboard data are independent requests against the same
      // token — run them together instead of serialising them behind /riders/me.
      await Promise.all([fetchRider(), fetchData()]);
      fetchBanks();
      fetchCampuses();
      setLoading(false);
    };
    init();
  }, []);

  // Reviews need the rider id; payouts are loaded when their tab opens.
  useEffect(() => {
    if (rider) fetchReviews();
  }, [rider?.id]);

  // Refresh payouts or reviews when switching to their dedicated tab
  useEffect(() => {
    if (!rider) return;
    if (activeTab === "payouts") fetchPayouts();
    if (activeTab === "reviews") fetchReviews();
  }, [activeTab]);

  // Opening the Profile tab always starts from saved data. This discards any
  // unsaved edit and resets the ID-type toggle to what is actually stored.
  useEffect(() => {
    if (activeTab !== "profile" || !rider) return;
    resetProfileForm(rider);
    setEditingProfile(false);
  }, [activeTab, rider?.id]);

  useEffect(() => {
    prevReviewCountRef.current = reviews.length;
  }, [reviews]);

  // ── SSE: real-time updates ──
  useNotificationPermission(!!rider);

  useSSE(
    async () => {
      const result = await fetchData({ silent: true });
      if (result) {
        const currentAvailable = result.availableOrders.length;
        if (currentAvailable > prevAvailableRef.current) {
          const diff = currentAvailable - prevAvailableRef.current;
          showMsg(`🔔 ${diff} new order${diff > 1 ? "s" : ""} available!`);
          notify("New Order Available!", {
            body: `${diff} new order${diff > 1 ? "s" : ""} ready for pickup.`,
          });
        }
        prevAvailableRef.current = currentAvailable;
      }

      const revData = await api
        .get(`/riders/${rider.id}/reviews`)
        .catch(() => null);
      const freshReviews = revData?.reviews || [];
      if (freshReviews.length > prevReviewCountRef.current) {
        const diff = freshReviews.length - prevReviewCountRef.current;
        showMsg(`⭐ ${diff} new review${diff > 1 ? "s" : ""} received!`);
        notify("New Review!", {
          body: `You received ${diff} new review${diff > 1 ? "s" : ""}.`,
          icon: "/favicon.svg",
        });
        setReviews(freshReviews);
        fetchRider();
      }
      prevReviewCountRef.current = freshReviews.length;
    },
    { enabled: !!rider, deps: [rider] }
  );

  // ── Filtered & Paginated History ──
  const filteredHistory = useMemo(() => {
    return pastDeliveries.filter((d) => {
      if (historyFilter !== "ALL" && d.status !== historyFilter) return false;
      if (historySearch.trim()) {
        const q = historySearch.trim().toLowerCase();
        const matchId = String(d.order?.id || "").includes(q);
        const matchRest = (d.order?.restaurant?.name || "")
          .toLowerCase()
          .includes(q);
        return matchId || matchRest;
      }
      return true;
    });
  }, [pastDeliveries, historyFilter, historySearch]);

  const totalHistoryPages = Math.max(
    1,
    Math.ceil(filteredHistory.length / ITEMS_PER_PAGE)
  );
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE
  );

  // ── Filtered & Paginated Reviews (For 400+ reviews) ──
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (
        reviewStarFilter !== "ALL" &&
        Number(r.rating) !== Number(reviewStarFilter)
      ) {
        return false;
      }
      if (reviewSearch.trim()) {
        const q = reviewSearch.trim().toLowerCase();
        const matchAuthor = (r.author?.name || "").toLowerCase().includes(q);
        const matchComment = (r.comment || "").toLowerCase().includes(q);
        return matchAuthor || matchComment;
      }
      return true;
    });
  }, [reviews, reviewStarFilter, reviewSearch]);

  const totalReviewPages = Math.max(
    1,
    Math.ceil(filteredReviews.length / ITEMS_PER_PAGE)
  );
  const paginatedReviews = filteredReviews.slice(
    (reviewPage - 1) * ITEMS_PER_PAGE,
    reviewPage * ITEMS_PER_PAGE
  );

  // ═════════════════════════════════════
  //  LOADING STATE
  // ═════════════════════════════════════
  if (loading) {
    return (
      <AppLayout desktopNavItems={RIDER_NAV} bottomNavItems={RIDER_NAV}>
        <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-12 pb-24">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-slate-200 rounded-lg" />
            <div className="h-4 w-64 bg-slate-200 rounded" />
            <div className="bg-white rounded-2xl p-6 space-y-4">
              <div className="h-6 w-32 bg-slate-200 rounded" />
              <div className="h-12 bg-slate-200 rounded-xl" />
              <div className="h-12 bg-slate-200 rounded-xl" />
              <div className="h-12 bg-slate-200 rounded-xl" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ═════════════════════════════════════
  //  NO RIDER PROFILE — registration form
  // ═════════════════════════════════════
  if (!loading && !error && !rider) {
    return (
      <AppLayout desktopNavItems={RIDER_NAV} bottomNavItems={RIDER_NAV}>
        <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-12 pb-24">
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-5xl text-amber-500">
                two_wheeler
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Welcome, {user?.name?.split(" ")[0] || "Rider"}!
            </h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Set up your rider profile to start accepting deliveries and
              earning money.
            </p>
            <span
              aria-label="Delivery Rider"
              title="Delivery Rider"
              className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-full mt-4"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                shield_person
              </span>
            </span>
          </div>

          {message && (
            <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 font-medium text-center">
              {message}
            </div>
          )}

          <form
            onSubmit={handleRegister}
            className="bg-white rounded-2xl shadow-sm p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900">Rider Profile</h3>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Profile Photo <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-4">
                {photo ? (
                  <img
                    src={photo}
                    alt="Profile preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-amber-300 shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-4xl text-slate-300">
                      person
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <label className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm cursor-pointer hover:border-amber-500 hover:text-amber-700 transition">
                    <span className="material-symbols-outlined text-lg">
                      {processingPhoto ? "hourglass_top" : "photo_camera"}
                    </span>
                    {processingPhoto
                      ? "Processing..."
                      : photo
                        ? "Change photo"
                        : "Take / upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-2">
                    A clear photo helps customers identify you at delivery.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Vehicle Type
              </label>
              <select
                required
                value={riderForm.vehicleType}
                onChange={(e) =>
                  setRiderForm({ ...riderForm, vehicleType: e.target.value })
                }
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm bg-white"
              >
                <option value="">Select vehicle type...</option>
                <option value="Motorcycle">Motorcycle</option>
                <option value="Car">Car</option>
                <option value="Bicycle">Bicycle</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="rider-campus"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Campus
              </label>
              <select
                id="rider-campus"
                required
                value={riderForm.campusId}
                onChange={(e) =>
                  setRiderForm({ ...riderForm, campusId: e.target.value })
                }
                disabled={Boolean(user?.campusId)}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm bg-white disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">
                  {campuses.length ? "Select your campus..." : "Loading campuses..."}
                </option>
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
              {user?.campusId && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Your rider profile must use your account's campus.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Identification
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIdType("license")}
                  className={`flex-1 h-12 rounded-xl border-2 text-sm font-semibold transition ${
                    idType === "license"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  🪪 License
                </button>
                <button
                  type="button"
                  onClick={() => setIdType("matric")}
                  className={`flex-1 h-12 rounded-xl border-2 text-sm font-semibold transition ${
                    idType === "matric"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  🎓 Student ID
                </button>
              </div>
            </div>

            {idType === "license" && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    License Plate
                  </label>
                  <input
                    required
                    placeholder="e.g. ABC 123 XY"
                    value={riderForm.licensePlate}
                    onChange={(e) =>
                      setRiderForm({
                        ...riderForm,
                        licensePlate: e.target.value,
                      })
                    }
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    License Number
                  </label>
                  <input
                    required
                    placeholder="e.g. DL-2024-12345"
                    value={riderForm.licenseNumber}
                    onChange={(e) =>
                      setRiderForm({
                        ...riderForm,
                        licenseNumber: e.target.value,
                      })
                    }
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                  />
                </div>
              </>
            )}

            {idType === "matric" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Matriculation Number
                </label>
                <input
                  required
                  placeholder="e.g. FPI/2024/12345"
                  value={riderForm.matricNumber}
                  onChange={(e) =>
                    setRiderForm({
                      ...riderForm,
                      matricNumber: e.target.value,
                    })
                  }
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                required
                type="tel"
                placeholder="e.g. +234 812 345 6789"
                value={riderForm.phone}
                onChange={(e) =>
                  setRiderForm({ ...riderForm, phone: e.target.value })
                }
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={registering}
              className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]"
            >
              {registering ? "Creating..." : "Create Rider Profile"}
            </button>
          </form>
        </div>
      </AppLayout>
    );
  }

  // ═════════════════════════════════════
  //  MAIN DASHBOARD (TABBED BY ROLE)
  // ═════════════════════════════════════
  return (
    <>
      <AppLayout
        desktopNavItems={RIDER_NAV}
        bottomNavItems={RIDER_NAV}
        showCart={false}
      >
        <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-5 pb-28 md:pb-10">
          {/* ── Top Rider Status Bar (Visible across tabs) ── */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 border border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-xl text-amber-600"
                    aria-hidden="true"
                  >
                    delivery_dining
                  </span>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                    {activeTab === "history"
                      ? "Delivery History"
                      : activeTab === "payouts"
                        ? "Earnings & Payouts"
                        : activeTab === "reviews"
                          ? "Customer Reviews"
                          : activeTab === "profile"
                            ? "Profile"
                            : "Live Dispatch"}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      rider?.isAvailable
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        rider?.isAvailable ? "bg-green-500" : "bg-slate-400"
                      }`}
                    />
                    {rider?.isAvailable ? "Online" : "Offline"}
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-0.5">
                  {rider?.vehicleType}
                  {rider?.licensePlate ? ` • ${rider.licensePlate}` : ""}
                  {rider?.matricNumber ? ` • ${rider.matricNumber}` : ""}
                  {rider?.reviewCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 ml-2 text-amber-700 font-semibold">
                      ★ {rider.avgRating} ({rider.reviewCount})
                    </span>
                  )}
                </p>
              </div>

              {/* Online / Offline Switch */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAvailability}
                  disabled={togglingAvailability}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    rider?.isAvailable ? "bg-green-500" : "bg-slate-300"
                  } ${togglingAvailability ? "opacity-50" : ""}`}
                  title={rider?.isAvailable ? "Go offline" : "Go online"}
                  aria-label={rider?.isAvailable ? "Go offline" : "Go online"}
                  aria-pressed={!!rider?.isAvailable}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                      rider?.isAvailable ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Compact Quick Summary Pill on the Deliveries Tab */}
            {activeTab === "deliveries" && (
              <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-end gap-4 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Total earned
                  </p>
                  <p className="text-base font-extrabold text-slate-900">
                    {stats ? (
                      formatCurrency(stats.totalEarnings)
                    ) : (
                      <span className="inline-block h-5 w-16 animate-pulse rounded bg-slate-200" />
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Trips
                  </p>
                  <p className="text-base font-extrabold text-slate-900">
                    {stats ? (
                      stats.totalDeliveries
                    ) : (
                      <span className="inline-block h-5 w-8 animate-pulse rounded bg-slate-200" />
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setSearchParams({ tab: "payouts" })}
                  className="flex items-center gap-0.5 text-xs font-bold text-amber-700 hover:text-amber-800"
                >
                  Wallet
                  <span className="material-symbols-outlined text-sm">
                    chevron_right
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Eligibility notices — a rider can be online and still unable to accept. */}
          {rider?.isSuspended && (
            <div className="mb-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <span className="material-symbols-outlined text-red-600">
                do_not_disturb_on
              </span>
              <div>
                <p className="text-sm font-bold text-red-800">
                  Account suspended
                </p>
                <p className="text-xs text-red-700 mt-0.5">
                  {rider.suspensionReason
                    ? `Reason: ${rider.suspensionReason}`
                    : "Contact your campus admin to restore your rider account."}
                </p>
              </div>
            </div>
          )}
          {rider && !rider.isVerified && !rider.isSuspended && (
            <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <span className="material-symbols-outlined text-amber-700">
                verified
              </span>
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Verification pending
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  A campus admin needs to verify your profile before you can
                  accept deliveries.
                </p>
              </div>
            </div>
          )}

          {/* Toast */}
          {message && (
            <div
              onClick={() => setMessage("")}
              className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium cursor-pointer flex items-center justify-between"
            >
              <span>{message}</span>
              <span className="material-symbols-outlined text-amber-400 text-lg">
                close
              </span>
            </div>
          )}

          {/* Data error */}
          {dataError && !dataLoading && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 font-medium mb-4 flex items-center justify-between">
              <span>{dataError}</span>
              <button
                onClick={fetchData}
                className="font-bold underline hover:text-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              PROFILE (post-registration management)
             ═══════════════════════════════════════════════════ */}
          {activeTab === "profile" && profileForm && (
            <section className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Your profile</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {rider.user?.name} · {rider.user?.email}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    rider.isVerified
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      rider.isVerified ? "bg-green-500" : "bg-amber-500"
                    }`}
                  />
                  {rider.isVerified ? "Verified" : "Verification pending"}
                </span>
              </div>

              <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                    {profilePhoto ? (
                      <img
                        src={profilePhoto}
                        alt="Rider profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-3xl text-slate-300">
                        person
                      </span>
                    )}
                  </div>
                  {editingProfile && (
                    <div>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition">
                        <span className="material-symbols-outlined text-sm">
                          {processingProfilePhoto ? "hourglass_top" : "photo_camera"}
                        </span>
                        {processingProfilePhoto
                          ? "Processing..."
                          : profilePhoto
                            ? "Change photo"
                            : "Add photo"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePhotoChange}
                          className="hidden"
                          disabled={processingProfilePhoto}
                        />
                      </label>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        A clear photo helps customers identify you.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Vehicle type
                    </label>
                    <select
                      value={profileForm.vehicleType}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, vehicleType: e.target.value })
                      }
                      disabled={!editingProfile}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="">Select vehicle...</option>
                      <option value="Motorcycle">Motorcycle</option>
                      <option value="Car">Car</option>
                      <option value="Bicycle">Bicycle</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Phone number
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, phone: e.target.value })
                      }
                      disabled={!editingProfile}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="+234..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Campus
                  </label>
                  {/* The account's campus is authoritative — the server refuses
                      a change, so the selector is read-only. */}
                  <select
                    value={profileForm.campusId}
                    disabled
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">
                      {campuses.length ? "Select your campus..." : "Loading campuses..."}
                    </option>
                    {campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Your campus is tied to your account. Contact a campus admin
                    to change it.
                  </p>
                </div>

                <div>
                  <p className="block text-sm font-semibold text-slate-700 mb-2">
                    Identification
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileIdType("license")}
                      disabled={!editingProfile}
                      className={`flex-1 h-10 rounded-xl border-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                        profileIdType === "license"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      🪪 License
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileIdType("matric")}
                      disabled={!editingProfile}
                      className={`flex-1 h-10 rounded-xl border-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                        profileIdType === "matric"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      🎓 Student ID
                    </button>
                  </div>
                </div>

                {profileIdType === "license" ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        License plate
                      </label>
                      <input
                        value={profileForm.licensePlate}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, licensePlate: e.target.value })
                        }
                        disabled={!editingProfile}
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                        placeholder="e.g. LAG-12345"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        License number
                      </label>
                      <input
                        value={profileForm.licenseNumber}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, licenseNumber: e.target.value })
                        }
                        disabled={!editingProfile}
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                        placeholder="e.g. LAG-12345"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Matric number
                    </label>
                    <input
                      value={profileForm.matricNumber}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, matricNumber: e.target.value })
                      }
                      disabled={!editingProfile}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="e.g. RUN/CMP/23/15250"
                    />
                  </div>
                )}

                {editingProfile ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCancelProfile}
                      disabled={savingProfile}
                      className="flex-1 h-11 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]"
                    >
                      {savingProfile ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleEditProfile}
                    className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition active:scale-[0.98]"
                  >
                    Edit profile
                  </button>
                )}
              </form>
            </section>
          )}

          {/* ═══════════════════════════════════════════════════
              TAB 1: DELIVERIES (Available Orders vs My Delivery)
             ═══════════════════════════════════════════════════ */}
          {activeTab === "deliveries" && (
            <div>
              {/* Segmented Toggle Bar — eliminates vertical stacking */}
              <div className="grid grid-cols-2 bg-slate-200/80 p-1 rounded-2xl mb-4">
                <button
                  type="button"
                  onClick={() => setDispatchView("available")}
                  className={`py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                    dispatchView === "available"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>Available</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      availableOrders.length > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {availableOrders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDispatchView("active")}
                  className={`py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                    dispatchView === "active"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>My Delivery</span>
                  {activeDelivery ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      0
                    </span>
                  )}
                </button>
              </div>

              {dataLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-white rounded-2xl p-5">
                      <div className="h-5 w-32 bg-slate-200 rounded mb-3" />
                      <div className="h-4 w-full bg-slate-200 rounded mb-2" />
                      <div className="h-4 w-3/4 bg-slate-200 rounded" />
                    </div>
                  ))}
                </div>
              ) : dispatchView === "available" ? (
                /* ── Sub-view A: Available Orders ── */
                rider?.isSuspended ? (
                  <div className="bg-white rounded-2xl shadow-sm text-center py-12 px-4">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-3xl text-red-600">
                        do_not_disturb_on
                      </span>
                    </div>
                    <p className="text-base font-bold text-slate-800">
                      Account suspended
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Contact your campus admin to restore your rider account.
                    </p>
                  </div>
                ) : !rider?.isVerified ? (
                  <div className="bg-white rounded-2xl shadow-sm text-center py-12 px-4">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-3xl text-amber-700">
                        verified
                      </span>
                    </div>
                    <p className="text-base font-bold text-slate-800">
                      Verification pending
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      A campus admin must verify your profile before you can
                      accept deliveries.
                    </p>
                  </div>
                ) : !rider?.isAvailable ? (
                  <div className="bg-white rounded-2xl shadow-sm text-center py-12 px-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-3xl text-slate-500">
                        do_not_disturb_on
                      </span>
                    </div>
                    <p className="text-base font-bold text-slate-800">
                      You are currently offline
                    </p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Switch your status to Online to receive new delivery
                      requests.
                    </p>
                    <button
                      onClick={handleToggleAvailability}
                      disabled={togglingAvailability}
                      className="bg-green-700 hover:bg-green-800 text-white text-sm font-bold px-6 py-2.5 rounded-full transition"
                    >
                      Go Online Now
                    </button>
                  </div>
                ) : availableOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm text-center py-14 px-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-3xl text-slate-300">
                        inventory_2
                      </span>
                    </div>
                    <p className="text-slate-700 text-sm font-bold">
                      No available orders right now
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                      New delivery requests will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl shadow-sm overflow-hidden border border-amber-100"
                      >
                        <div className="px-5 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">
                                Order #{order.id}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  ORDER_STATUS[order.status]?.color
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    ORDER_STATUS[order.status]?.dot
                                  }`}
                                />
                                {ORDER_STATUS[order.status]?.label ||
                                  order.status}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500">
                              {new Date(order.createdAt).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="material-symbols-outlined text-amber-500 text-lg">
                              storefront
                            </span>
                            <span className="text-sm font-semibold text-slate-800">
                              {order.restaurant?.name}
                            </span>
                            {order.restaurant?.phone && (
                              <span className="text-xs text-slate-500">
                                · {order.restaurant.phone}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 mb-3 bg-slate-50 rounded-xl p-2.5 space-y-0.5">
                            {order.orderItems?.map((item) => (
                              <p key={item.id}>
                                {item.quantity}x{" "}
                                {item.menuItem?.name || "Item"}{" "}
                                <span className="text-slate-500">
                                  @ {formatCurrency(Number(item.unitPrice))}
                                </span>
                              </p>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
                            <span className="material-symbols-outlined text-lg text-slate-500">
                              person
                            </span>
                            <span className="font-medium text-slate-700">
                              {order.customer?.name || "Customer"}
                            </span>
                            {order.customer?.phone && (
                              <span className="text-slate-500 text-xs">
                                · {order.customer.phone}
                              </span>
                            )}
                          </div>

                          <div className="flex items-start gap-2 mb-4 text-sm text-slate-600">
                            <span className="material-symbols-outlined text-lg text-slate-500">
                              location_on
                            </span>
                            <span>{order.deliveryAddress}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <span className="text-base font-extrabold text-slate-900">
                              {formatCurrency(Number(order.totalAmount))}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleReject(order.id)}
                                disabled={
                                  rejectingOrderId === order.id ||
                                  acceptingOrderId === order.id
                                }
                                className="bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-600 border border-slate-200 text-sm font-semibold px-3 py-2 rounded-full transition active:scale-95"
                                title="Skip this order"
                              >
                                {rejectingOrderId === order.id ? (
                                  "Skipping..."
                                ) : (
                                  <span className="material-symbols-outlined text-base">
                                    close
                                  </span>
                                )}
                              </button>
                              <button
                                onClick={() => handleAccept(order.id)}
                                disabled={
                                  acceptingOrderId === order.id ||
                                  rejectingOrderId === order.id
                                }
                                className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white text-sm font-bold px-6 py-2.5 rounded-full transition active:scale-95"
                              >
                                {acceptingOrderId === order.id
                                  ? "Accepting..."
                                  : "Accept Delivery"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* ── Sub-view B: My Active Delivery ── */
                !activeDelivery ? (
                  <div className="bg-white rounded-2xl shadow-sm text-center py-14 px-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-3xl text-slate-300">
                        local_shipping
                      </span>
                    </div>
                    <p className="text-slate-700 text-sm font-bold">
                      No active delivery
                    </p>
                    <p className="text-slate-500 text-xs mt-1 mb-4">
                      Accept an order from the Available tab to start a trip.
                    </p>
                    <button
                      onClick={() => setDispatchView("available")}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold px-5 py-2.5 rounded-full transition"
                    >
                      View Available Orders ({availableOrders.length})
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-purple-100">
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            Order #{activeDelivery.order?.id}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              DELIVERY_STATUS[activeDelivery.status]?.color
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                DELIVERY_STATUS[activeDelivery.status]?.dot
                              }`}
                            />
                            {DELIVERY_STATUS[activeDelivery.status]?.label}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {new Date(activeDelivery.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <DeliveryProgress status={activeDelivery.status} />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-sm">
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-xs text-slate-500 mb-0.5">
                            Pickup
                          </p>
                          <p className="font-semibold text-slate-800">
                            {activeDelivery.order?.restaurant?.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {activeDelivery.order?.restaurant?.address}
                          </p>
                          {activeDelivery.order?.restaurant?.phone && (
                            <a
                              href={`tel:${activeDelivery.order.restaurant.phone}`}
                              className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold mt-1"
                            >
                              <span className="material-symbols-outlined text-sm">
                                call
                              </span>
                              {activeDelivery.order.restaurant.phone}
                            </a>
                          )}
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-xs text-slate-500 mb-0.5">
                            Customer Dropoff
                          </p>
                          <p className="font-semibold text-slate-800">
                            {activeDelivery.order?.customer?.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {activeDelivery.order?.deliveryAddress}
                          </p>
                          {activeDelivery.order?.customer?.phone &&
                            (isEmail(activeDelivery.order.customer.phone) ? (
                              <a
                                href={`mailto:${activeDelivery.order.customer.phone}`}
                                className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold mt-1"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  mail
                                </span>
                                {activeDelivery.order.customer.phone}
                              </a>
                            ) : (
                              <a
                                href={`tel:${activeDelivery.order.customer.phone}`}
                                className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold mt-1"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  call
                                </span>
                                {activeDelivery.order.customer.phone}
                              </a>
                            ))}
                        </div>
                      </div>

                      <div className="mb-3">
                        <DeliveryMap
                          restaurant={activeDelivery.order?.restaurant}
                          delivery={activeDelivery.order}
                        />
                      </div>

                      <div className="text-sm text-slate-500 mb-4 space-y-0.5">
                        {activeDelivery.order?.orderItems?.map((item) => (
                          <p key={item.id}>
                            {item.quantity}x{" "}
                            {item.menuItem?.name || "Item"}
                          </p>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-bold text-slate-900">
                          Total:{" "}
                          {formatCurrency(
                            Number(activeDelivery.order?.totalAmount)
                          )}
                        </span>
                        {(() => {
                          const [etaMin, etaMax] = estimateETA(
                            rider?.vehicleType,
                            activeDelivery.status
                          );
                          return (
                            <span className="text-xs text-slate-500 font-medium">
                              ⏱ ~{etaMin}–{etaMax} min
                            </span>
                          );
                        })()}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {activeDelivery.status === "ZILLA_ON_IT" && (
                          <>
                            <button
                              onClick={() =>
                                handleUpdateDeliveryStatus(
                                  activeDelivery.id,
                                  "AT_KITCHEN"
                                )
                              }
                              disabled={
                                updatingDeliveryId === activeDelivery.id
                              }
                              className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-slate-950 text-sm font-bold px-5 py-2.5 rounded-full transition active:scale-95 flex-1"
                            >
                              {updatingDeliveryId === activeDelivery.id
                                ? "Updating..."
                                : "Arrived At Kitchen"}
                            </button>
                            <button
                              onClick={() => {
                                setFailTarget(activeDelivery.id);
                                setFailReason("");
                              }}
                              disabled={
                                updatingDeliveryId === activeDelivery.id
                              }
                              className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                            >
                              Report Issue
                            </button>
                          </>
                        )}
                        {activeDelivery.status === "AT_KITCHEN" && (
                          <>
                            <button
                              onClick={() =>
                                handleUpdateDeliveryStatus(
                                  activeDelivery.id,
                                  "BAGGED"
                                )
                              }
                              disabled={
                                updatingDeliveryId === activeDelivery.id
                              }
                              className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-slate-950 text-sm font-bold px-5 py-2.5 rounded-full transition active:scale-95 flex-1"
                            >
                              {updatingDeliveryId === activeDelivery.id
                                ? "Updating..."
                                : "Order Bagged"}
                            </button>
                            <button
                              onClick={() => {
                                setFailTarget(activeDelivery.id);
                                setFailReason("");
                              }}
                              disabled={
                                updatingDeliveryId === activeDelivery.id
                              }
                              className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                            >
                              Report Issue
                            </button>
                          </>
                        )}
                        {activeDelivery.status === "BAGGED" && (
                          <>
                            <button
                              onClick={() =>
                                handleUpdateDeliveryStatus(
                                  activeDelivery.id,
                                  "MOVING"
                                )
                              }
                              disabled={
                                updatingDeliveryId === activeDelivery.id
                              }
                              className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-slate-950 text-sm font-bold px-5 py-2.5 rounded-full transition active:scale-95 flex-1"
                            >
                              {updatingDeliveryId === activeDelivery.id
                                ? "Updating..."
                                : "Start Moving"}
                            </button>
                            <button
                              onClick={() => {
                                setFailTarget(activeDelivery.id);
                                setFailReason("");
                              }}
                              disabled={
                                updatingDeliveryId === activeDelivery.id
                              }
                              className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                            >
                              Report Issue
                            </button>
                          </>
                        )}
                        {activeDelivery.status === "MOVING" && (
                          <>
                            <button
                              onClick={() =>
                                handleHandoffStatus(
                                  activeDelivery.id,
                                  "CLOSE_BY"
                                )
                              }
                              disabled={
                                updatingDeliveryId === activeDelivery.id ||
                                locating
                              }
                              className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-slate-950 text-sm font-bold px-5 py-2.5 rounded-full transition active:scale-95 flex-1"
                            >
                              {locating
                                ? "Checking location..."
                                : updatingDeliveryId === activeDelivery.id
                                  ? "Updating..."
                                  : "Close By Customer"}
                            </button>
                            <button
                              onClick={() => {
                                setFailTarget(activeDelivery.id);
                                setFailReason("");
                              }}
                              disabled={
                                updatingDeliveryId === activeDelivery.id
                              }
                              className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                            >
                              Report Issue
                            </button>
                          </>
                        )}
                        {activeDelivery.status === "CLOSE_BY" && (
                          <div className="w-full flex flex-col gap-3">
                            <p className="text-xs font-medium text-slate-500">
                              Ask the customer for their 4-digit code, then
                              confirm to complete the delivery.
                            </p>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              value={deliveryCode}
                              onChange={(e) =>
                                setDeliveryCode(
                                  e.target.value.replace(/\D/g, "")
                                )
                              }
                              placeholder="4-digit code"
                              aria-label="Customer 4-digit delivery code"
                              className="w-full rounded-full border-2 border-slate-200 px-4 py-2.5 text-center text-lg font-bold tracking-[0.5em] outline-none focus:border-green-500"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDeliver(activeDelivery.id)}
                                disabled={
                                  updatingDeliveryId === activeDelivery.id ||
                                  locating
                                }
                                className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95 flex-1"
                              >
                                {locating
                                  ? "Checking location..."
                                  : updatingDeliveryId === activeDelivery.id
                                    ? "Updating..."
                                    : "Confirm & Deliver"}
                              </button>
                              <button
                                onClick={() => {
                                  setFailTarget(activeDelivery.id);
                                  setFailReason("");
                                }}
                                disabled={
                                  updatingDeliveryId === activeDelivery.id
                                }
                                className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                              >
                                Report Issue
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              TAB 2: HISTORY (Searchable, Filterable & Paginated)
             ═══════════════════════════════════════════════════ */}
          {activeTab === "history" && (
            <div className="space-y-4">
              {/* Search + Filter Bar */}
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <div className="relative">
                  <span className="material-symbols-outlined text-slate-500 text-lg absolute left-3.5 top-1/2 -translate-y-1/2">
                    search
                  </span>
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="Search by Order # or restaurant..."
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { key: "ALL", label: `All (${pastDeliveries.length})` },
                    { key: "DELIVERED", label: "Delivered" },
                    { key: "FAILED", label: "Failed" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => {
                        setHistoryFilter(f.key);
                        setHistoryPage(1);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
                        historyFilter === f.key
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                    history
                  </span>
                  <p className="text-sm font-bold text-slate-700">
                    No matching deliveries found
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Completed and failed trips will appear here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedHistory.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="bg-white rounded-2xl shadow-sm px-5 py-4 border border-slate-100"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              Order #{delivery.order?.id}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                DELIVERY_STATUS[delivery.status]?.color
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  DELIVERY_STATUS[delivery.status]?.dot
                                }`}
                              />
                              {DELIVERY_STATUS[delivery.status]?.label}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(delivery.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-amber-500">
                              storefront
                            </span>
                            <span className="font-medium">
                              {delivery.order?.restaurant?.name}
                            </span>
                          </div>
                          {delivery.order?.totalAmount && (
                            <span className="font-bold text-slate-900">
                              {formatCurrency(
                                Number(delivery.order.totalAmount)
                              )}
                            </span>
                          )}
                        </div>
                        {delivery.deliveredAt && (
                          <p className="text-xs text-slate-500 mt-1.5">
                            Delivered:{" "}
                            {new Date(delivery.deliveredAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {totalHistoryPages > 1 && (
                    <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm">
                      <button
                        onClick={() =>
                          setHistoryPage((p) => Math.max(1, p - 1))
                        }
                        disabled={historyPage === 1}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-semibold text-slate-500">
                        Page {historyPage} of {totalHistoryPages}
                      </span>
                      <button
                        onClick={() =>
                          setHistoryPage((p) =>
                            Math.min(totalHistoryPages, p + 1)
                          )
                        }
                        disabled={historyPage === totalHistoryPages}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Failure history — the Delivery row is deleted on
                  reassignment, so DeliveryFailure is the complete record. */}
              {failures.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                    Failure history
                  </h3>
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                    {failures.map((f, idx) => (
                      <div
                        key={f.id}
                        className={`px-5 py-3.5 ${
                          idx < failures.length - 1 ? "border-b border-slate-100" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Order #{f.orderId}
                              {f.restaurant ? ` · ${f.restaurant}` : ""}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {f.kind === "CODE_ATTEMPTS"
                                ? `Too many wrong codes (${f.codeAttempts})`
                                : f.reason ||
                                  (f.kind === "STALE"
                                    ? "Timed out"
                                    : "Reported failure")}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-slate-500">
                            {new Date(f.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              TAB 3: PAYOUTS (4 Stat Cards + Bank Setup + Payouts)
             ═══════════════════════════════════════════════════ */}
          {activeTab === "payouts" && (
            <div className="space-y-5">
              {/* 4 Stat Cards live here now! */}
              {/* Always rendered so the cards below don't jump when stats arrive. */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total earned", value: stats && formatCurrency(stats.totalEarnings) },
                  { label: "Paid out", value: stats && formatCurrency(stats.paidEarnings) },
                  { label: "Pending payout", value: stats && formatCurrency(stats.pendingEarnings), accent: true },
                  { label: "This week", value: stats && formatCurrency(stats.thisWeekEarnings) },
                  { label: "Total deliveries", value: stats?.totalDeliveries },
                  { label: "Week trips", value: stats?.thisWeekDeliveries },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100"
                  >
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
                      {item.label}
                    </p>
                    {item.value === undefined || item.value === null ? (
                      <span className="inline-block h-7 w-20 rounded bg-slate-200 animate-pulse" />
                    ) : (
                      <p
                        className={`text-xl font-extrabold ${
                          item.accent ? "text-amber-700" : "text-slate-900"
                        }`}
                      >
                        {item.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Bank Account Card */}
              <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Payout Bank Account
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Your delivery fees are sent here automatically when an order
                  is completed.
                </p>

                {rider.accountName && !editingBank ? (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
                      <p className="font-semibold text-emerald-800">
                        {rider.accountName}
                      </p>
                      <p className="text-emerald-700 text-xs mt-0.5">
                        {rider.bankName || "Bank"} · ••••{" "}
                        {rider.accountNumber?.slice(-4)}
                      </p>
                    </div>
                    {rider.bankDetailsReviewRequired && (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                        These bank details are pending admin approval. Payouts
                        stay on hold until they are approved.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBank(true);
                        setResolvedName(rider.accountName);
                      }}
                      className="w-full h-10 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm transition active:scale-[0.98]"
                    >
                      Edit bank details
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSaveBank} className="space-y-3">
                    <div>
                      <label
                        htmlFor="bank-account-number"
                        className="block text-xs font-semibold text-slate-500 mb-1"
                      >
                        Account Number
                      </label>
                      <input
                        id="bank-account-number"
                        value={bankForm.accountNumber}
                        onChange={(e) => {
                          setBankForm({
                            ...bankForm,
                            accountNumber: e.target.value.replace(/\D/g, ""),
                          });
                          setResolvedName(null);
                        }}
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="10-digit account number"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="bank-code"
                        className="block text-xs font-semibold text-slate-500 mb-1"
                      >
                        Bank
                      </label>
                      <select
                        id="bank-code"
                        value={bankForm.bankCode}
                        onChange={(e) => {
                          const bank = banks.find(
                            (b) => b.code === e.target.value
                          );
                          setBankForm({
                            ...bankForm,
                            bankCode: e.target.value,
                            bankName: bank?.name || "",
                          });
                          setResolvedName(null);
                        }}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm bg-white"
                      >
                        <option value="">
                          {banks.length ? "Select bank" : "Loading banks..."}
                        </option>
                        {banks.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyAccount}
                      disabled={verifying}
                      className="w-full h-10 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 font-semibold text-sm transition active:scale-[0.98]"
                    >
                      {verifying ? "Verifying..." : "Verify Account"}
                    </button>
                    {resolvedName && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
                        <p className="text-xs text-emerald-600 mb-0.5">
                          Account name
                        </p>
                        <p className="font-semibold text-emerald-800">
                          {resolvedName}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {editingBank && (
                        <button
                          type="button"
                          onClick={() => setEditingBank(false)}
                          className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={savingBank || !resolvedName}
                        className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]"
                      >
                        {savingBank ? "Saving..." : "Save Bank Details"}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Payout History List */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Recent Payouts
                </h3>
                {payoutsLoading ? (
                  <div className="h-24 bg-slate-200 animate-pulse rounded-2xl" />
                ) : payouts.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                    <p className="text-xs text-slate-500">
                      No payouts yet. Your earnings appear here once orders are
                      delivered.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                    {payouts.map((p, idx) => (
                      <div
                        key={p.id}
                        className={`px-5 py-3.5 flex items-center justify-between ${
                          idx < payouts.length - 1
                            ? "border-b border-slate-100"
                            : ""
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Order #{p.orderId}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </p>
                          {p.held && (
                            <p className="text-[11px] font-medium text-amber-600 mt-0.5">
                              Bank details awaiting approval
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.held
                                ? "bg-amber-100 text-amber-700"
                                : p.status === "SUCCESS"
                                  ? "bg-green-100 text-green-700"
                                  : p.status === "FAILED"
                                    ? "bg-red-100 text-red-700"
                                    : p.status === "REVERSED"
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {p.held ? "ON HOLD" : p.status}
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {formatCurrency(p.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              TAB 4: REVIEWS (Star Filter + Search + Pagination)
             ═══════════════════════════════════════════════════ */}
          {activeTab === "reviews" && (
            <div className="space-y-4">
              {/* Rating Summary & Search/Filter Controls */}
              <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Overall Rating
                    </p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-slate-900">
                        {rider?.avgRating || "—"}
                      </span>
                      <span className="text-amber-700 text-lg">★</span>
                      <span className="text-xs text-slate-500">
                        ({reviews.length}{" "}
                        {reviews.length === 1 ? "review" : "reviews"})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Search Input for Reviews */}
                <div className="relative">
                  <span className="material-symbols-outlined text-slate-500 text-lg absolute left-3.5 top-1/2 -translate-y-1/2">
                    search
                  </span>
                  <input
                    type="text"
                    value={reviewSearch}
                    onChange={(e) => {
                      setReviewSearch(e.target.value);
                      setReviewPage(1);
                    }}
                    placeholder="Search reviews by customer or keyword..."
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:border-amber-500 outline-none"
                  />
                </div>

                {/* Star Rating Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {["ALL", 5, 4, 3, 2, 1].map((star) => (
                    <button
                      key={star}
                      onClick={() => {
                        setReviewStarFilter(star);
                        setReviewPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
                        reviewStarFilter === star
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {star === "ALL" ? "All Stars" : `${star} ★`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paginated Reviews List */}
              {reviewsLoading ? (
                <div className="h-24 bg-slate-200 animate-pulse rounded-2xl" />
              ) : filteredReviews.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
                  <p className="text-sm font-bold text-slate-700">
                    No matching reviews
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Customers can rate and review you after each delivery.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedReviews.map((r) => (
                      <div
                        key={r.id}
                        className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-bold text-slate-900">
                            {r.author?.name || "Customer"}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 mb-2">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              className={`material-symbols-outlined text-amber-500 text-sm ${
                                n <= r.rating
                                  ? "filled-icon"
                                  : " opacity-30"
                              }`}
                            >
                              star
                            </span>
                          ))}
                        </div>
                        {r.comment && (
                          <p className="text-sm text-slate-600">{r.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls for 400+ Reviews */}
                  {totalReviewPages > 1 && (
                    <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm">
                      <button
                        onClick={() =>
                          setReviewPage((p) => Math.max(1, p - 1))
                        }
                        disabled={reviewPage === 1}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-semibold text-slate-500">
                        Page {reviewPage} of {totalReviewPages}
                      </span>
                      <button
                        onClick={() =>
                          setReviewPage((p) =>
                            Math.min(totalReviewPages, p + 1)
                          )
                        }
                        disabled={reviewPage === totalReviewPages}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </AppLayout>

      {/* ── FAILED Confirmation Dialog ── */}
      {failTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setFailTarget(null);
              setFailReason("");
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-2xl text-red-500">
                  warning
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Report Delivery Issue?
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                This will release the order for another rider. The customer will
                be notified.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Reason {failNeedsReason ? "(required)" : "(optional)"}
              </label>
              <textarea
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="e.g. Restaurant closed, customer unreachable..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none transition text-sm resize-none"
              />
              {failNeedsReason && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  The food has already been picked up, so a short reason is
                  required.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFailTarget(null);
                  setFailReason("");
                }}
                className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={confirmFail}
                disabled={
                  failNeedsReason &&
                  failReason.trim().length < FAIL_REASON_MIN_LENGTH
                }
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition active:scale-95 disabled:bg-red-300 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Location fallback dialog ── */}
      {locationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setLocationTarget(null);
              setLocationReason("");
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-2xl text-amber-700">
                  warning
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Location could not be verified
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                We couldn't get an accurate GPS reading. Add a short reason to
                continue; this delivery will be flagged for review.
              </p>
            </div>

            <div>
              <label
                htmlFor="location-reason"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Reason (required)
              </label>
              <textarea
                id="location-reason"
                value={locationReason}
                onChange={(e) =>
                  setLocationReason(e.target.value.slice(0, 300))
                }
                maxLength={300}
                rows={3}
                placeholder="e.g. GPS unavailable inside the hostel"
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition text-sm resize-none"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                At least 5 characters. Repeated unverified deliveries are
                reviewed by the campus admin.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setLocationTarget(null);
                  setLocationReason("");
                }}
                className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={confirmLocationFallback}
                disabled={locationReason.trim().length < 5}
                className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-slate-950 font-bold text-sm transition active:scale-95"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RiderDashboard;