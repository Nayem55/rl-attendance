import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import * as XLSX from "xlsx"; // <-- Import XLSX

const ViewReport = () => {
  const { userId } = useParams();
  const [userName, setUserName] = useState("");
  const [records, setRecords] = useState([]);
  const [updatedStatuses, setUpdatedStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    if (!storedUser) {
      navigate("/login");
    }
  }, []);

  useEffect(() => {
    fetchUserReport(selectedMonth);
  }, [selectedMonth]);

  const fetchUserReport = async (month) => {
    setLoading(true);
    setError(null);
    try {
      const [year, monthNumber] = month.split("-");
      const userResponse = await axios.get(
        `https://attendance-app-server-blue.vercel.app/getUser/${userId}`
      );
      setUserName(userResponse.data.name);

      const checkInsResponse = await axios.get(
        `https://attendance-app-server-blue.vercel.app/api/checkins/${userId}`,
        {
          params: { month: monthNumber, year: year },
        }
      );
      const checkOutsResponse = await axios.get(
        `https://attendance-app-server-blue.vercel.app/api/checkouts/${userId}`,
        {
          params: { month: monthNumber, year: year },
        }
      );

      const checkIns = checkInsResponse.data;
      const checkOuts = checkOutsResponse.data;

      const combinedRecords = checkIns.map((checkIn) => {
        const checkOut = checkOuts.find(
          (co) =>
            dayjs(co.time).isSame(checkIn.time, "day") &&
            dayjs(co.time).isAfter(checkIn.time)
        );

        return {
          checkInId: checkIn._id,
          date: dayjs(checkIn?.time).format("DD MMMM YYYY"),
          checkInTime: dayjs(checkIn?.time).format("hh:mm A") || "N/A",
          checkInNote: checkIn?.note || "N/A",
          checkInLocation: checkIn?.location,
          checkOutTime: checkOut?.time
            ? dayjs(checkOut?.time).format("hh:mm A")
            : "N/A",
          checkOutNote: checkOut?.note || "N/A",
          checkOutLocation: checkOut?.location || "N/A",
          status: checkIn.status,
        };
      });

      setRecords(combinedRecords);
    } catch (error) {
      console.error("Error fetching user report:", error);
      setError("Failed to load report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
  };

  const handleStatusChange = (checkInId, newStatus) => {
    setUpdatedStatuses((prev) => ({
      ...prev,
      [checkInId]: newStatus,
    }));
  };

  const saveStatus = async (checkInId) => {
    const newStatus = updatedStatuses[checkInId];
    if (!newStatus) {
      toast.error("Please select a status to update.");
      return;
    }

    try {
      const response = await axios.put(
        `https://attendance-app-server-blue.vercel.app/api/update-status/${checkInId}`,
        { status: newStatus }
      );

      toast.success(response.data.message);
      setRecords((prevReports) =>
        prevReports.map((report) =>
          report.checkInId === checkInId
            ? { ...report, status: newStatus }
            : report
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status. Please try again.");
    }
  };

  const exportToExcel = () => {
    const worksheetData = records.map((record) => ({
      Username: userName,
      Date: record.date,
      "Check-In Time": record.checkInTime,
      "Check-In Note": record.checkInNote,
      "Check-In Location": record.checkInLocation,
      "Check-Out Time": record.checkOutTime,
      "Check-Out Note": record.checkOutNote,
      "Check-Out Location": record.checkOutLocation,
      Status: record.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    XLSX.writeFile(workbook, `${userName}-Monthly-Report.xlsx`);
  };

  return (
    <div className="flex">
      {/* Sidebar */}
      <div
        className={`fixed md:relative z-20 bg-gray-800 text-white w-64 h-screen transform ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300`}
      >
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold">Admin Panel</h2>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="text-white md:hidden focus:outline-none"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-col p-4 space-y-2">
          <Link to="/admin/today-report" className="hover:bg-gray-700 px-4 py-2 rounded">Today's Report</Link>
          <Link to="/admin/monthly-summary" className="hover:bg-gray-700 px-4 py-2 rounded">Monthly Summary</Link>
          <Link to="/admin/monthly-details" className="hover:bg-gray-700 px-4 py-2 rounded">Monthly Details</Link>
          <Link to="/admin/applications" className="hover:bg-gray-700 px-4 py-2 rounded">Leave Requests</Link>
          {storedUser?.role === "super admin" && (
            <Link to="/admin/user" className="hover:bg-gray-700 px-4 py-2 rounded">Users</Link>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-screen p-4 md:p-6 bg-gray-100">
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="md:hidden mb-4 px-4 py-2 bg-gray-800 text-white rounded"
        >
          {isDrawerOpen ? "Close Menu" : "Open Menu"}
        </button>

        <h1 className="text-xl font-bold mb-4">Monthly Report for {userName}</h1>

        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <div>
            <label className="mr-2 font-semibold">Select Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="border rounded px-2 py-1"
            />
          </div>

          <button
            onClick={exportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            Export to Excel
          </button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border px-4 py-2">Username</th>
                  <th className="border px-4 py-2">Date</th>
                  <th className="border px-4 py-2">Check-In Time</th>
                  <th className="border px-4 py-2">Check-In Note</th>
                  <th className="border px-4 py-2">Check-In Location</th>
                  <th className="border px-4 py-2">Check-Out Time</th>
                  <th className="border px-4 py-2">Check-Out Note</th>
                  <th className="border px-4 py-2">Check-Out Location</th>
                  <th className="border px-4 py-2">Status</th>
                  <th className="border px-4 py-2">Update Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr key={index} className="text-center">
                    <td className="border px-4 py-2">{userName}</td>
                    <td className="border px-4 py-2">{record.date}</td>
                    <td className="border px-4 py-2">{record.checkInTime}</td>
                    <td className="border px-4 py-2">{record.checkInNote}</td>
                    <td className="border px-4 py-2">{record.checkInLocation}</td>
                    <td className="border px-4 py-2">{record.checkOutTime}</td>
                    <td className="border px-4 py-2">{record.checkOutNote}</td>
                    <td className="border px-4 py-2">{record.checkOutLocation}</td>
                    <td
                      className={`border font-bold px-4 py-2 ${
                        record.status === "Pending"
                          ? "text-[#002B54]"
                          : ["Rejected", "Late", "Absent"].includes(record.status)
                          ? "text-[#B7050E]"
                          : "text-[#0DC143]"
                      }`}
                    >
                      {record.status}
                    </td>
                    <td className="border px-4 py-2 flex gap-4 items-center">
                      <select
                        className="px-2 py-1"
                        value={updatedStatuses[record.checkInId] || ""}
                        onChange={(e) =>
                          handleStatusChange(record.checkInId, e.target.value)
                        }
                      >
                        <option value="">Update Status</option>
                        <option value="Approved Late">Approved Late</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved Leave">Approved Leave</option>
                        <option value="Success">Success</option>
                        <option value="Late">Late</option>
                      </select>
                      <button
                        onClick={() => saveStatus(record.checkInId)}
                        className="bg-[#1F2937] hover:bg-[#002B54] text-white px-2 py-1 rounded"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No records found for this month.</p>
        )}
      </div>
    </div>
  );
};

export default ViewReport;
