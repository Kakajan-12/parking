import { useState, useEffect, useRef } from "react";
import { IoSearch } from "react-icons/io5";
import { AiOutlineClockCircle } from "react-icons/ai";
import { HiSignal } from "react-icons/hi2";
import { Link } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { TbReportAnalytics } from "react-icons/tb";
import { MdCameraAlt } from "react-icons/md";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../components/AuthContext';
import { FormattedMessage, useIntl } from 'react-intl';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';


const Video = () => {
  const lastEventIdRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [modalOpenPhoto, setModalOpenPhoto] = useState(false);
  const [selectedLogPhoto, setSelectedLogPhoto] = useState(null);
  const [cars, setCars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCars, setTotalCars] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [reason, setReason] = useState("");
  const { auth } = useAuth();
  const [modalOpenUnified, setModalOpenUnified] = useState(false);
  const [selectedCarLog, setSelectedCarLog] = useState(null);


  const [shiftProfit, setShiftProfit] = useState(() => {
    const storedProfit = localStorage.getItem("shiftProfit");
    return storedProfit !== null ? Number(storedProfit) : 0;
  });
  const navigate = useNavigate();
  const intl = useIntl();
  const queryClient = useQueryClient();
  const limit = 10;
  const lastUpdatedCarRef = useRef(null);

  // Загружаем прибыль при первом рендере
  useEffect(() => {
    const storedProfit = localStorage.getItem("shiftProfit");
    if (storedProfit !== null) {
      setShiftProfit(Number(storedProfit));
      console.log("✅ Загружена прибыль:", storedProfit);
    }
  }, []);

  // Сохраняем прибыль при каждом изменении
  useEffect(() => {
    console.log("💾 Сохраняем прибыль:", shiftProfit);
    localStorage.setItem("shiftProfit", shiftProfit);
  }, [shiftProfit]);


  useEffect(() => {
    console.log("🔥 Cars updated:", cars);
  }, [cars]);


  const useFetchCars = () => {
    return useQuery({
      queryKey: ['cars', page, searchQuery, startDate, endDate, status, auth.parkno],
      queryFn: fetchCars,
      keepPreviousData: true, // Prevents flickering
    });
  };

  const defaultChannelIds = {
    'P3': '8dc9685f-a80b-4d95-ae19-da340efe89ab',
    'P3-05': 'aa7eec70-cda7-493f-a523-809877fe4d34',
    'P3-06': '8dc9685f-a80b-4d95-ae19-da340efe89ab',
    'P4': '"a6c7cccc-d00c-4d6d-8717-b38c2a97172e"',
  };


  const statuses = [
    { value: "Inside", label: intl.formatMessage({ id: "video.status.inside", defaultMessage: "Inside" }), color: "text-yellow-500" },
    { value: "Exited", label: intl.formatMessage({ id: "video.status.exited", defaultMessage: "Exited" }), color: "text-green-600" },
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString(intl.locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateForApi = (date) => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  };

  const formatDateTimeForApi = (date) => {
    return date.toISOString();
  };

  const fetchCarDetails = async (carNumber, channelId, useNows = false) => {
    console.log("Validating carNumber:", carNumber, "ChannelId:", channelId);

    if (!carNumber || typeof carNumber !== "string" || !/^[A-Z0-9]{5,8}$/.test(carNumber.trim())) {
      console.error("Invalid carNumber format:", carNumber);
      throw new Error(intl.formatMessage({
        id: "video.error.invalidCarNumberFormat",
        defaultMessage: "Invalid car number format. Expected format: AB1234AG"
      }));
    }
    if (!auth.parkno || typeof auth.parkno !== "string") {
      console.error("Invalid parkno:", auth.parkno);
      throw new Error("Invalid park number provided");
    }
    if (!channelId || typeof channelId !== "string") {
      console.error("Invalid ChannelId:", channelId);
      throw new Error("Invalid channel ID provided");
    }

    const API_URL = import.meta.env.VITE_API_URL || "http://172.16.4.204:3000";
    const endpoint = useNows ? `${API_URL}/api/v1/camera/getdata/nows` : `${API_URL}/api/v1/camera/getdata`;
    const now = new Date();
    const formattedTime = formatDateTimeForApi(now);
    const requestBody = {
      EventComment: carNumber.trim(),
      ChannelName: auth.parkno,
      ChannelId: channelId,
      EventDescription: "Fetch car details",
      EventId: `EVT-${Date.now()}`,
      captured_time: formattedTime
    };

    console.log("Sending fetchCarDetails request:", { endpoint, requestBody });

    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("fetchCarDetails failed:", {
          status: response.status,
          statusText: response.statusText,
          errorMessage: errorData.message || "No error message provided",
          errorData,
        });
        throw new Error(errorData.message || `Invalid request: ${response.status}`);
      }

      const data = await response.json();
      console.log("fetchCarDetails response:", data);

      // Обновляем проверку структуры ответа
      const carData = data.car || data.data; // Используем data.car, если доступно
      if (!carData) {
        console.error("No car data in response:", data);
        throw new Error("No car data returned");
      }

      if (carData.total_payment == null) {
        console.warn(`No total_payment in response for car ${carNumber}. Possibly waiting for end_time or incorrect ChannelId.`);
      }

      return carData; // Возвращаем carData напрямую
    } catch (error) {
      console.error("fetchCarDetails error:", error.message);
      throw error;
    }
  };

  const useFetchCarDetails = () => {
    return useMutation({
      mutationFn: ({ carNumber, channelId, useNows }) => fetchCarDetails(carNumber, channelId, useNows),
      onSuccess: (data) => {
        console.log("Car details fetched successfully:", data);
      },
      onError: (error) => {
        console.error("Error fetching car details:", error.message);
        toast.error(intl.formatMessage({ id: "video.error.fetchCarDetails", defaultMessage: "Ошибка при получении данных автомобиля" }));
      },
    });
  };

  const fetchCars = async () => {
    setIsLoading(true);
    setError(null);
    const API_URL = import.meta.env.VITE_API_URL || "http://172.16.4.204:3000";

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchQuery && { car_number: searchQuery.trim() }),
        ...(startDate && { enter_time: formatDateForApi(startDate) }),
        ...(endDate && { end_time: formatDateForApi(endDate) }),
        ...(status && { status }),
        ...(auth.role === 'operator' && auth.parkno && { park_no: auth.parkno }),
      });

      const url = `${API_URL}/api/v1/searchcar?${params.toString()}`;
      console.log("📡 Fetching cars with URL:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: "include",
      });

      if (response.status === 401) {
        const message = intl.formatMessage({ id: "auth.sessionExpired", defaultMessage: "Session expired. Please log in again." });
        setError(message);
        toast.error(message);
        navigate("/login");
        return [];
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ Fetch cars failed:", { status: response.status, errorData });
        throw new Error(errorData.message || intl.formatMessage({ id: "error.api", defaultMessage: "API error: {status}", values: { status: response.status } }));
      }

      const data = await response.json();
      console.log("📊 Fetched cars data:", data);

      if (!data.cars || data.cars.length === 0) {
        console.log("ℹ️ No cars found for filters");
        toast.info(intl.formatMessage({ id: "video.noData", defaultMessage: "No data found for the selected filters." }));
        setCars([]);
        setTotalCars(0);
        setTotalPages(1);
        return [];
      }

      const updatedCars = data.cars.map((car) => ({
        id: car.id,
        parking: car.park_no,
        number: car.car_number,
        entryTime: formatDate(car.start_time),
        departureTime: formatDate(car.end_time),
        price: `${car.total_payment ?? 0} TMT`,
        image_url: car.image_url,
        status: car.status,
        start_time: car.start_time,
        total_payment: car.total_payment,
        ChannelId: car.ChannelId || defaultChannelIds[car.park_no] || "",
        cameraid: car.cameraid,
      }));
      console.log("🚗 Setting new cars state in fetchCars:", updatedCars);
      setCars([...updatedCars]); // Create a new array to ensure useEffect triggers
      setTotalCars(data.total || data.cars.length);
      setTotalPages(data.totalPages || Math.ceil(data.total / limit) || 1);
      return updatedCars;
    } catch (err) {
      const message = err.message || intl.formatMessage({ id: "login.error.network", defaultMessage: "Network error. Please try again later." });
      console.error("❌ Error fetching cars:", {
        message,
        url: err.request?.url,
        status: err.response?.status,
      });
      setError(message);
      toast.error(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const useUpdateCar = () => {
    return useMutation({
      mutationFn: ({ plate, reason, total_payment, end_time, status }) => {
        const API_URL = import.meta.env.VITE_API_URL || "http://172.16.4.204:3000";
        const requestBody = {
          reason,
          total_payment,
          end_time,
          status,
          paystatus: status === "Exited" ? true : undefined,
        };
  
        console.log("Sending update car request:", {
          url: `${API_URL}/api/v1/camera/updatecar/${plate}`,
          body: requestBody,
        });
  
        return fetch(`${API_URL}/api/v1/camera/updatecar/${plate}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(requestBody),
        }).then((res) => {
          if (!res.ok) throw new Error(`Failed to update car: ${res.status}`);
          return res.json();
        });
      },
      onSuccess: (data) => {
        console.log("Car updated successfully:", data);
        queryClient.invalidateQueries(['cars']); // Triggers useFetchCars
      },
      onError: (error) => {
        console.error("Error updating car:", error);
        toast.error(intl.formatMessage({ id: "video.error.updateCar", defaultMessage: "Error updating car data: {error}", values: { error: error.message } }));
      },
    });
  };

  const useManualPayed = () => {
    const { mutate: updateCar } = useUpdateCar();
    return useMutation({
      mutationFn: ({ amount, parkno, car_number }) => {
        const API_URL = import.meta.env.VITE_API_URL || "http://172.16.4.204:3000";
        const requestBody = {
          reason: "paid",
          total_payment: amount,
          end_time: formatDateTimeForApi(new Date()),
          status: "Exited",
          paystatus: true,
        };

        console.log("Sending payment request:", {
          url: `${API_URL}/api/v1/camera/updatecar/${car_number}`,
          body: requestBody,
        });

        return fetch(`${API_URL}/api/v1/camera/updatecar/${car_number}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(requestBody),
        }).then((res) => {
          if (!res.ok) throw new Error(`Failed to process payment: ${res.status}`);
          return res.json();
        });
      },
      onSuccess: (data, { car_number, close }) => {
        console.log("Payment processed successfully:", data);
        updateCar({
          plate: car_number,
          reason: "paid",
          total_payment: data.data?.total_payment,
          end_time: data.data?.end_time,
          status: "Exited",
          paystatus: true,
        });
        const payment = data.data?.total_payment || 0;
        setShiftProfit(prev => {
          const updated = prev + payment;
          localStorage.setItem("shiftProfit", updated); // ✅ сразу сохраняем
          return updated;
        });

        close();
      },
      onError: (error) => {
        console.error("Error processing payment:", error);
        toast.error(intl.formatMessage({ id: "video.error.processPayment", defaultMessage: "Error processing payment: {error}", values: { error: error.message } }));
      },
    });
  };


  const { mutate: fetchCar } = useFetchCarDetails();
  const { mutate: updateCar } = useUpdateCar();
  const { mutateAsync: manualPayed } = useManualPayed();

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const tryFetchCarDetails = async (carNumber, channelId, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const data = await fetchCarDetails(carNumber, channelId, false);
        if (data?.total_payment != null) return data;
        console.warn(`Retry ${i + 1}: total_payment is still null`);
      } catch (err) {
        console.error(`Retry ${i + 1} failed:`, err.message);
      }
      await wait(delay);
    }
    throw new Error("Failed to fetch total_payment after retries");
  };

  const updateCarHandler = async (carNumber, barrierId, channelId) => {
    console.log("🔄 updateCarHandler started:", { carNumber, barrierId, channelId });
    lastUpdatedCarRef.current = carNumber;
    const car = cars.find((c) => c.number === carNumber);
    if (!car) {
      toast.error(intl.formatMessage({ id: "video.error.carNotFound", defaultMessage: "Car not found" }));
      return;
    }

    if (car.status !== "Inside" && car.status !== "Pending") {
      toast.error(intl.formatMessage({ id: "video.error.notInside", defaultMessage: "Cannot open barrier: Car is not inside or pending" }));
      return;
    }

    if (!reason) {
      toast.error(intl.formatMessage({ id: "video.error.noReason", defaultMessage: "Please enter a reason for opening the barrier" }));
      return;
    }

    if (!channelId) {
      toast.error(intl.formatMessage({ id: "video.error.noChannelId", defaultMessage: "No channel ID provided" }));
      return;
    }

    const endTime = new Date().toISOString();

    try {
      console.log("📡 Sending updateCar (initial exit fix)");
      await updateCar({
        plate: carNumber,
        reason,
        total_payment: 0, // Temporarily 0
        end_time: endTime,
        status: "Exited",
      });

      console.log("⏳ Retrying fetchCarDetails until total_payment available...");
      const updatedData = await tryFetchCarDetails(carNumber, channelId, 3, 1000);
      console.log("✅ Got car data:", updatedData);

      const totalPayment = updatedData.total_payment || 0;

      // Update local state with a new array to ensure React detects the change
      setCars((prevCars) => {
        const newCars = prevCars.map((c) =>
          c.number === carNumber
            ? {
              ...c,
              status: "Exited",
              departureTime: formatDate(updatedData.end_time),
              price: `${totalPayment} TMT`,
              total_payment: totalPayment,
              end_time: updatedData.end_time,
            }
            : c
        );
        console.log("🚗 Setting new cars state in updateCarHandler:", newCars);
        return [...newCars]; // Create a new array to trigger useEffect
      });

      console.log("💵 Sending manualPayed...");
      await manualPayed({
        amount: totalPayment,
        parkno: car.parking,
        car_number: carNumber,
        close: () => {
          setModalOpenUnified(false);
          setReason("");
        },
      });

      console.log("🚧 Opening barrier...");
      await openBarrier(channelId);

      // Fetch fresh data from server to ensure sync
      console.log("🔄 Fetching cars to sync with server...");
      await fetchCars();

      toast.success(intl.formatMessage({
        id: "video.barrierOpened",
        defaultMessage: "Barrier {barrierId} opened and payment processed",
      }, { barrierId }));
    } catch (err) {
      console.error("❌ updateCarHandler failed:", err);
      toast.error(intl.formatMessage({
        id: "video.error.network",
        defaultMessage: "Network error. Please try again later.",
      }) + (err.message ? ` (${err.message})` : ""));
    }
  };


  const openModal = (log) => {
    console.log("Opening modal for car:", log);
    if (!log?.number || !log?.parking) {
      console.error("Invalid log data:", log);
      toast.error(intl.formatMessage({ id: "video.error.invalidLog", defaultMessage: "Invalid car data" }));
      return;
    }

    const channelId = log.ChannelId || defaultChannelIds[log.parking] || "";
    if (!channelId) {
      console.warn("No valid ChannelId for car:", log.number);
      toast.warn(intl.formatMessage({ id: "video.warning.noChannelId", defaultMessage: "No channel ID available. Some actions may be limited." }));
      setSelectedLog({
        ...log,
        price: `${log.total_payment ?? 0} TMT`,
        total_payment: log.total_payment,
        ChannelId: "",
      });
      setModalOpenUnified(true);
      return;
    }

    fetchCar(
      { carNumber: log.number, channelId, useNows: false },
      {
        onSuccess: (data) => {
          const totalPayment = data.total_payment;
          if (totalPayment == null) {
            console.warn("total_payment not provided by backend");
            toast.warn(intl.formatMessage({
              id: "video.error.noTotalPayment",
              defaultMessage: "Payment not calculated yet, car may still be inside"
            }));
            setSelectedCarLog({
              ...log,
              price: intl.formatMessage({
                id: "video.error.noTotalPayment",
                defaultMessage: "Payment not calculated yet, car may still be inside"
              }),
              total_payment: null,
              ChannelId: channelId,
            });
            setModalOpenUnified(true);
            setReason("");
            return;
          }

          const updatedLog = {
            ...log,
            price: `${data.total_payment ?? 0} TMT`,
            total_payment: totalPayment,
            status: data.status || log.status,
            start_time: data.start_time || log.start_time,
            end_time: data.end_time || log.end_time,
            departureTime: formatDate(data.end_time),
            image_url: data.image_url || log.image_url,
            parking: data.park_no || log.parking,
            ChannelId: data.ChannelId || channelId,
          };

          setSelectedCarLog(updatedLog);
          setModalOpenUnified(true);

          // ✅ ВАЖНО: вот это добавь
          setCars((prevCars) =>
            prevCars.map((car) =>
              car.id === log.id
                ? { ...car, ...updatedLog }
                : car
            )
          );
        },
        onError: async (error) => {
          console.warn("Primary fetch failed, trying fallback:", error.message);
          try {
            const data = await fetchCarDetails(log.number, channelId, true);
            const totalPayment = data.total_payment;
            if (totalPayment == null) {
              console.warn("total_payment not provided by backend");
              toast.warn(intl.formatMessage({
                id: "video.error.noTotalPayment",
                defaultMessage: "Payment not calculated yet, car may still be inside"
              }));
              setSelectedCarLog({
                ...log,
                price: intl.formatMessage({
                  id: "video.error.noTotalPayment",
                  defaultMessage: "Payment not calculated yet, car may still be inside"
                }),
                total_payment: null,
                ChannelId: channelId,
              });
              setModalOpenUnified(true);
              return;
            }
            const updatedLog = {
              ...log,
              price: `${data.total_payment ?? 0} TMT`,
              total_payment: totalPayment,
              status: data.status || log.status,
              start_time: data.start_time || log.start_time,
              end_time: data.end_time || log.end_time,
              departureTime: formatDate(data.end_time),
              image_url: data.image_url || log.image_url,
              parking: data.park_no || log.parking,
              ChannelId: data.ChannelId || channelId,
            };
            setSelectedCarLog(updatedLog);
            setModalOpenUnified(true);
          } catch (fallbackError) {
            console.error("Fallback fetch failed:", fallbackError.message);
            toast.error(intl.formatMessage({
              id: "video.error.fetchCarDetails",
              defaultMessage: "Ошибка при получении данных автомобиля"
            }));
            setSelectedCarLog({
              ...log,
              price: `${log.total_payment ?? 0} TMT`,
              total_payment: log.total_payment,
              ChannelId: channelId,
            });
            setModalOpenUnified(true);
          }
        },
      }
    );
  };

  const openModalPhoto = (log) => {
    console.log("Opening photo modal for car:", log);
    if (!log?.image_url) {
      console.error("No image_url provided for car:", log);
      toast.error(intl.formatMessage({ id: "video.error.noImage", defaultMessage: "No image available" }));
      return;
    }
    setSelectedLogPhoto(log);
    setModalOpenPhoto(true);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      console.log("Switching to page:", newPage);
    }
  };

  const handleSearchChange = (e) => {
    const upperCaseValue = e.target.value.toUpperCase();
    setSearchQuery(upperCaseValue);
    setPage(1);
    console.log("Search:", upperCaseValue);
  };

  const handleDateChange = (setter) => (date) => {
    setter(date);
    setPage(1);
    console.log("Date:", date);
  };

  const handleStatusChange = (value) => {
    setStatus(value);
    setOpen(false);
    setPage(1);
    console.log("Status:", value);
  };

  const selectedStatus = statuses.find((s) => s.value === status);

  const pageNumbers = [];
  const maxPagesToShow = 5;
  const startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
  const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  const { data: fetchedCars, isFetchingCars } = useFetchCars();

  useEffect(() => {
    if (auth.isLoading) return;
  
    if (!auth.isAuthenticated) {
      const message = intl.formatMessage({ id: "auth.sessionExpired", defaultMessage: "Session expired. Please log in again." });
      toast.error(message);
      navigate("/login");
      return;
    }
  
    if (auth.role === 'operator' && !auth.parkno) {
      const message = intl.formatMessage({ id: "auth.selectPark", defaultMessage: "Please select a park." });
      toast.error(message);
      navigate("/login");
      return;
    }
  
    if (fetchedCars) {
      console.log("🚗 Setting cars from useFetchCars:", fetchedCars);
      setCars([...fetchedCars]); // Create new array
    }
  }, [fetchedCars, auth, navigate, intl]);

  useEffect(() => {
    const wsUrl = `${import.meta.env.VITE_WS_URL || "ws://172.16.4.204:3000"}/ws/notification`;
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectInterval = 3000;

    const connectWebSocket = () => {
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
      }

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        reconnectAttempts = 0;
      };

      ws.onmessage = async (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
          console.log("📨 WebSocket data:", data);

          // Check for invalid data
          if (!data || !data.id || !data.car_number) {
            console.warn("Invalid WebSocket data:", data);
            return;
          }

          // Ignore updates for recently processed car
          if (data.car_number === lastUpdatedCarRef.current) {
            console.log("🚫 Ignoring WebSocket update for recently processed car:", data.car_number);
            return;
          }

          if (auth.parkno && data.park_no !== auth.parkno) {
            console.log(`Ignoring WS message - not for current park (${auth.parkno}):`, data.park_no);
            return;
          }

          // Filter duplicates
          if (data.id === lastEventIdRef.current) return;
          lastEventIdRef.current = data.id;

          // Form modal data
          const logData = {
            id: data.id,
            number: data.car_number,
            entryTime: data.start_time,
            departureTime: data.end_time,
            price: `${data.total_payment} TMT`,
            image_url: data.image_url || "/photo.jpg",
            ChannelId: data.ChannelId || null,
          };

          setSelectedCarLog(logData);
          setModalOpenUnified(true);

          // Update cars for "Exited" status
          if (data.status === "Exited") {
            setCars((prevCars) => {
              const newCars = prevCars.map((car) =>
                car.id === data.id
                  ? {
                    ...car,
                    departureTime: formatDate(data.end_time),
                    price: `${data.total_payment ?? 0} TMT`,
                    status: data.status,
                    total_payment: data.total_payment,
                    end_time: data.end_time,
                  }
                  : car
              );
              console.log("🚗 Setting new cars state in WebSocket:", newCars);
              return [...newCars]; // Create new array
            });
          }

          // Handle "refresh" signal
          if (data === "refresh") {
            console.log("🔄 WebSocket refresh signal received");
            await fetchCars();
            return;
          }

          // Handle "Pending" status
          if (
            typeof data !== "string" &&
            auth.role === "operator" &&
            data.park_no === auth.parkno &&
            data.status === "Pending"
          ) {
            const channelId = data.ChannelId || defaultChannelIds[data.park_no] || "";
            if (!channelId) {
              toast.warn(
                intl.formatMessage({
                  id: "video.warning.noChannelId",
                  defaultMessage: "No channel ID available. Some actions may be limited.",
                })
              );
              return;
            }

            fetchCar(
              { carNumber: data.car_number, channelId, useNows: false },
              {
                onSuccess: (carData) => {
                  const paymentLog = {
                    id: data.id,
                    number: data.car_number,
                    parking: data.park_no,
                    entryTime: formatDate(data.start_time),
                    departureTime: formatDate(data.end_time),
                    price: `${carData.total_payment ?? data.total_payment ?? 0} TMT`,
                    image_url: carData.image_url || data.image_url,
                    status: carData.status || data.status,
                    start_time: carData.start_time || data.start_time,
                    end_time: carData.end_time || data.end_time,
                    ChannelId: carData.ChannelId || channelId,
                    cameraid: carData.cameraid || data.cameraid,
                    total_payment: carData.total_payment ?? data.total_payment,
                  };
                  setSelectedCarLog(paymentLog);
                  setModalOpenUnified(true);
                },
                onError: async () => {
                  try {
                    const carData = await fetchCarDetails(data.car_number, channelId, true);
                    setSelectedCarLog(carData);
                    setModalOpenUnified(true);
                  } catch (err) {
                    console.error("Fallback fetch failed:", err.message);
                    toast.error(
                      intl.formatMessage({
                        id: "video.error.fetchCarDetails",
                        defaultMessage: "Error fetching car details",
                      })
                    );
                  }
                },
              }
            );
          }
        } catch (err) {
          console.error("Error processing WebSocket data:", err);
          return;
        }
      };

      ws.onclose = () => {
        console.log("🔴 WebSocket connection closed");

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(`🔄 Attempting to reconnect WebSocket (${reconnectAttempts}/${maxReconnectAttempts})...`);
          setTimeout(connectWebSocket, reconnectInterval);
        } else {
          console.error("❌ Max WebSocket reconnect attempts reached");
          toast.error(
            intl.formatMessage({
              id: "video.error.websocket",
              defaultMessage: "WebSocket connection failed",
            })
          );
        }
      };

      ws.onerror = (error) => {
        console.error("⚠️ WebSocket error:", error);

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(`🔄 Attempting to reconnect WebSocket after error (${reconnectAttempts}/${maxReconnectAttempts})...`);
          setTimeout(connectWebSocket, reconnectInterval);
        }
      };

    };

    connectWebSocket();

    return () => {
      if (ws) ws.close();
    };
  }, [auth, intl, fetchCar, fetchCars]);

  if (auth.isLoading) {
    return (
      <div className="bg-white rounded-br-2xl rounded-bl-2xl p-4 h-[93%] text-center text-gray-600">
        <FormattedMessage id="dashboard.loading" defaultMessage="Loading..." />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-br-2xl rounded-bl-2xl p-4 h-[93%]">
      <div className="flex flex-col h-full">
        <div className="flex justify-between">
          <div className="flex space-x-6">
            <div className="relative border-2 border-gray-300 rounded-3xl px-4 py-1 flex items-center h-10">
              <input
                type="text"
                placeholder={intl.formatMessage({ id: "video.search", defaultMessage: "Search" })}
                className="outline-none text-black"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2">
                <IoSearch color="gray" />
              </span>
            </div>
            <div className="relative border-2 border-gray-300 rounded-3xl px-4 mx-2 py-1 flex items-center h-10">
              <DatePicker
                selected={startDate}
                onChange={handleDateChange(setStartDate)}
                isClearable
                placeholderText={intl.formatMessage({ id: "video.startDate", defaultMessage: "Start Date" })}
                dateFormat="yyyy-MM-dd"
                className="p-2 outline-none text-black"
                onKeyDown={(e) => e.preventDefault()}
              />
              {!startDate && (
                <span className="absolute right-5 top-1/2 -translate-y-1/2">
                  <AiOutlineClockCircle color="gray" />
                </span>
              )}
            </div>
            <div className="relative border-2 border-gray-300 rounded-3xl px-4 py-1 flex items-center h-10">
              <DatePicker
                selected={endDate}
                onChange={handleDateChange(setEndDate)}
                isClearable
                placeholderText={intl.formatMessage({ id: "video.endDate", defaultMessage: "End Date" })}
                dateFormat="yyyy-MM-dd"
                className="p-2 outline-none text-black"
                onKeyDown={(e) => e.preventDefault()}
              />
              {!endDate && (
                <span className="absolute right-5 top-1/2 -translate-y-1/2">
                  <AiOutlineClockCircle color="gray" />
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-lg shadow">
            <span className="font-semibold mr-2">Прибыль за смену:</span>
            <span className="text-xl font-bold">{shiftProfit} TMT</span>
          </div>
          <div className="flex justify-center items-center space-x-2">
            <div className="mr-2">
              <Link>
                <HiSignal color="#5459EA" size={30} />
              </Link>
            </div>
            <div className="relative inline-block w-36">
              <button
                onClick={() => setOpen(!open)}
                className={`px-4 py-2 border rounded-md bg-white shadow-sm text-sm font-medium w-36 cursor-pointer ${selectedStatus ? selectedStatus.color : "text-gray-500"}`}
              >
                {selectedStatus ? selectedStatus.label : intl.formatMessage({ id: "video.status", defaultMessage: "Status" })}
              </button>
              {open && (
                <div className="absolute z-[1000] mt-2 w-36 bg-white border rounded-md shadow-lg">
                  {statuses.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => handleStatusChange(s.value)}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer ${s.color}`}
                    >
                      {s.label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleStatusChange(null)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-500 cursor-pointer"
                  >
                    <FormattedMessage id="video.allStatuses" defaultMessage="All Statuses" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white mt-2 flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="text-center p-4 text-gray-600">
                <FormattedMessage id="dashboard.loading" defaultMessage="Loading..." />
              </div>
            ) : error ? (
              <div className="text-center p-4 text-red-600">{error}</div>
            ) : cars.length === 0 ? (
              <div className="text-center p-4 text-gray-600">
                <FormattedMessage id="video.noData" defaultMessage="No data found for the selected filters." />
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr className="text-black text-md">
                    <th className="p-3">
                      <FormattedMessage id="video.table.id" defaultMessage="№" />
                    </th>
                    <th className="p-3">
                      <FormattedMessage id="video.table.parking" defaultMessage="Parking Number" />
                    </th>
                    <th className="p-3">
                      <FormattedMessage id="video.table.carNumber" defaultMessage="Car Number" />
                    </th>
                    <th className="p-3">
                      <FormattedMessage id="video.table.entryTime" defaultMessage="Entry Time" />
                    </th>
                    <th className="p-3">
                      <FormattedMessage id="video.table.departureTime" defaultMessage="Departure Time" />
                    </th>
                    <th className="p-3">
                      <FormattedMessage id="video.table.price" defaultMessage="Price" />
                    </th>
                    <th className="p-3 text-center" colSpan={2}>
                      <FormattedMessage id="video.table.actions" defaultMessage="Actions" />
                    </th>
                  </tr>
                </thead>
                <tbody className="text-black text-sm">
                  {cars.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{log.id}</td>
                      <td className="p-3">{log.parking}</td>
                      <td className="p-3">{log.number}</td>
                      <td className="p-3">{log.entryTime}</td>
                      <td className="p-3">{log.departureTime}</td>
                      <td className="p-3">{log.price}</td>
                      <td className="p-3 w-fit">
                        <button
                          onClick={() => openModal(log)}
                          className="flex space-x-2 items-center main-color rounded-2xl px-2 py-1 cursor-pointer"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <TbReportAnalytics size={25} color="white" />
                          <span className="text-white">
                            <FormattedMessage id="video.openBarrier" defaultMessage="Open Barrier" />
                          </span>
                        </button>
                      </td>
                      <td className="p-3 w-fit">
                        <button
                          onClick={() => openModalPhoto(log)}
                          className="flex space-x-2 items-center main-color rounded-2xl px-2 py-1 cursor-pointer"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <MdCameraAlt size={25} color="white" />
                          <span className="text-white">
                            <FormattedMessage id="video.viewPhoto" defaultMessage="View Photo" />
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="text-sm text-gray-700 p-2 font-semibold border-t flex justify-between">
            <div>
              <FormattedMessage
                id="video.totalLogs"
                defaultMessage="Total Logs: {count}"
                values={{ count: totalCars }}
              />
            </div>
            <div className="space-x-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1 || totalPages === 1}
                className={`border border-gray-400 p-1 rounded-md ${page === 1 || totalPages === 1 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <FormattedMessage id="video.prev" defaultMessage="Prev" />
              </button>
              {pageNumbers.map((num) => (
                <button
                  key={num}
                  onClick={() => handlePageChange(num)}
                  className={`rounded-md p-1 w-8 ${page === num ? "main-color text-white" : "border border-gray-400"}`}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages || totalPages === 1}
                className={`border border-gray-400 p-1 rounded-md ${page === totalPages || totalPages === 1 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <FormattedMessage id="video.next" defaultMessage="Next" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalOpenUnified && selectedCarLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-[1000]">
          <div className="bg-white p-10 rounded-xl w-full max-w-4xl shadow-lg relative">
            <button
              onClick={() => setModalOpenUnified(false)}
              className="absolute top-2 right-4 text-gray-600 hover:text-black text-2xl font-bold"
            >
              ×
            </button>
            <div>
              <img src={selectedCarLog?.image_url || "/photo.jpg"} alt="car" className="w-full rounded" />
            </div>
            <div className="flex justify-between space-x-6 pt-5 text-black">
              <div className="text-center">
                <p>Car Number</p>
                <p className="font-bold">{selectedCarLog?.number}</p>
              </div>
              <div className="text-center">
                <p>Entry Time</p>
                <p className="font-bold">{selectedCarLog?.entryTime}</p>
              </div>
              <div className="text-center">
                <p>Departure Time</p>
                <p className="font-bold">{selectedCarLog?.departureTime || "Not exited"}</p>
              </div>
              <div className="flex items-center">
                <h2 className="text-3xl font-semibold text-black">{selectedCarLog?.price || "Payment not calculated"}</h2>
              </div>
            </div>
            <div className="flex space-x-2 pt-5">
              <button

                className="px-4 py-2 text-white rounded main-color w-full mx-1 cursor-pointer"
              >
                Toledi
              </button>
            </div>
          </div>
        </div>
      )}
      {
        modalOpenPhoto && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-[1000]"
            onClick={() => {
              console.log("Closing photo modal");
              setModalOpenPhoto(false);
            }}
          >
            <div
              className="bg-white p-10 rounded-xl w-full max-w-7xl shadow-lg relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  console.log("Closing photo modal via button");
                  setModalOpenPhoto(false);
                }}
                className="absolute top-0 right-2 text-gray-600 hover:text-black text-2xl font-bold"
              >
                ×
              </button>
              <div>
                <img
                  src={selectedLogPhoto?.image_url || "/photo.jpg"}
                  alt="car"
                  className="w-full rounded"
                />
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Video;