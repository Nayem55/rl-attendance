import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

const AdminDashboard = () => {
  const [reports, setReports] = useState([]);
  const [group, setGroup] = useState("RL");
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [selectedRole, setSelectedRole] = useState("SO");
  const [selectedZone, setSelectedZone] = useState(""); // <-- NEW
  const [zones, setZones] = useState([]); // <-- NEW
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [error, setError] = useState(null);
  const [totalWorkingDays, setTotalWorkingDays] = useState(null);
  const [pendingReq, setPendingReq] = useState(0);
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem("user"));
  const dayCount = dayjs(selectedMonth).daysInMonth();

  /* ------------------------------------------------------------------ */
  /*  Redirect to login if no user in localStorage                      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!storedUser) {
      navigate("/login");
    }
  }, [navigate]);

  /* ------------------------------------------------------------------ */
  /*  Fetch working-days, reports & pending requests                    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    fetchWorkingDays(selectedMonth);
    fetchUserReports(
      selectedMonth,
      selectedRole,
      storedUser.group || (selectedRole === "super admin" ? "" : group),
      storedUser.zone,
      selectedZone
    );
    fetchPendingRequest();
  }, [selectedMonth, selectedRole, group, selectedZone]); // <-- added selectedZone

  /* ------------------------------------------------------------------ */
  /*  Fetch unique zones (once) – you can also hard-code them          */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const loadZones = async () => {
      try {
        const res = await axios.get(
          `https://attendance-app-server-blue.vercel.app/getAllUser`
        );

        const uniqueZones = [
          ...new Set(
            res.data
              .map((u) => u.zone)
              .filter(Boolean)
              .filter((z) => /zone/i.test(z)) // <-- ONLY ZONES WITH "zone"
          ),
        ];

        setZones(uniqueZones);
      } catch (err) {
        console.error("Failed to load zones", err);
      }
    };

    if (storedUser?.role === "super admin") loadZones();
  }, [storedUser?.role]);

  /* ------------------------------------------------------------------ */
  /*  API helpers                                                       */
  /* ------------------------------------------------------------------ */
  const fetchPendingRequest = async () => {
    try {
      const response = await axios.get(
        `https://attendance-app-server-blue.vercel.app/api/pending-requests`
      );
      setPendingReq(response.data.pendingCount);
    } catch (error) {
      console.error("Error fetching pending requests:", error);
      setPendingReq(0);
    }
  };

  const fetchWorkingDays = async (month) => {
    try {
      const response = await axios.get(
        `https://attendance-app-server-blue.vercel.app/api/workingdays`,
        { params: { month } }
      );
      setTotalWorkingDays(response.data.workingDays);
    } catch (error) {
      console.error("Error fetching working days:", error);
      setTotalWorkingDays(null);
    }
  };

  const fetchApprovedLeaves = async (userId, month, year) => {
    try {
      const response = await axios.get(
        `https://attendance-app-server-blue.vercel.app/api/leave-requests/user/${userId}/monthly`,
        { params: { month, year } }
      );
      return response.data.leaveDays || 0;
    } catch (error) {
      console.error(
        `Error fetching approved leaves for user ${userId}:`,
        error
      );
      return 0;
    }
  };

  const fetchUserReports = async (
    month,
    role,
    group,
    userZone,
    zoneFilter = ""
  ) => {
    setLoading(true);
    setError(null);
    try {
      const [year, monthNumber] = month.split("-");

      const usersResponse = await axios.get(
        `https://attendance-app-server-blue.vercel.app/getAllUser`,
        {
          params: {
            role,
            group,
            zone: storedUser?.role === "super admin" ? zoneFilter : userZone,
          },
        }
      );
      const users = usersResponse.data;

      const reportsData = await Promise.all(
        users.map(async (user) => {
          const checkInsResponse = await axios.get(
            `https://attendance-app-server-blue.vercel.app/api/checkins/${user._id}`,
            { params: { month: monthNumber, year } }
          );
          const checkOutsResponse = await axios.get(
            `https://attendance-app-server-blue.vercel.app/api/checkouts/${user._id}`,
            { params: { month: monthNumber, year } }
          );

          const checkIns = checkInsResponse.data;
          const checkOuts = checkOutsResponse.data;
          const totalCheckIns = checkIns.length;

          const lateCheckInsCount = checkIns.filter(
            (c) => c.status === "Late"
          ).length;
          const lateCheckOutsCount = checkOuts.filter(
            (c) => c.status === "Overtime"
          ).length;

          const approvedLeaveDays = await fetchApprovedLeaves(
            user._id,
            monthNumber,
            year
          );

          return {
            username: user.name,
            number: user.number,
            role: user.role,
            userId: user._id,
            totalCheckIns,
            lateCheckIns: lateCheckInsCount,
            lateCheckOuts: lateCheckOutsCount,
            approvedLeaves: approvedLeaveDays,
            month: monthNumber,
            year,
            zone: user.zone,
          };
        })
      );

      setReports(reportsData);
    } catch (error) {
      console.error("Error fetching reports:", error);
      setError("Failed to load reports. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Handlers                                                          */
  /* ------------------------------------------------------------------ */
  const handleMonthChange = (e) => setSelectedMonth(e.target.value);
  const handleRoleChange = (e) => setSelectedRole(e.target.value);
  const handleZoneChange = (e) => setSelectedZone(e.target.value); // <-- NEW

  /* ------------------------------------------------------------------ */
  /*  Export to Excel                                                   */
  /* ------------------------------------------------------------------ */
  const exportToExcel = () => {
    const worksheetData = reports.map((report) => ({
      Name: report.username,
      Number: report.number,
      Role: report.role,
      Zone: report.zone,
      "Total Working Days": totalWorkingDays,
      Holidays:
        dayCount -
        totalWorkingDays -
        (report.totalCheckIns - totalWorkingDays > 0
          ? report.totalCheckIns - totalWorkingDays
          : 0),
      "Approved Leave": report.approvedLeaves,
      Absent:
        totalWorkingDays - report.totalCheckIns - report.approvedLeaves > 0
          ? totalWorkingDays - report.totalCheckIns - report.approvedLeaves
          : 0,
      "Extra Day":
        report.totalCheckIns - totalWorkingDays > 0
          ? report.totalCheckIns - totalWorkingDays
          : 0,
      "Total Check-Ins": report.totalCheckIns,
      "Late Check-Ins (10.15 AM)": report.lateCheckIns,
      "Late Check-Outs (8.00 PM)": report.lateCheckOuts,
      "Late Adjustment": report.lateCheckIns - report.lateCheckOuts,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Report");
    XLSX.writeFile(workbook, `Monthly_Report_${selectedMonth}.xlsx`);
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <div className="flex">
      {/* ---------- Side Drawer ---------- */}
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
          <Link
            to="/admin/today-report"
            className="px-4 py-2 rounded hover:bg-gray-700 focus:bg-gray-700"
          >
            Today's Report
          </Link>
          <Link
            to="/admin/monthly-summary"
            className="px-4 py-2 rounded hover:bg-gray-700 focus:bg-gray-700"
          >
            Monthly Summary
          </Link>
          <Link
            to="/admin/monthly-details"
            className="px-4 py-2 rounded hover:bg-gray-700 focus:bg-gray-700"
          >
            Monthly Details
          </Link>
          <Link
            to="/admin/applications"
            className="px-4 py-2 rounded hover:bg-gray-700 focus:bg-gray-700"
          >
            Leave Requests
          </Link>
          {storedUser?.role === "super admin" && (
            <Link
              to="/admin/user"
              className="px-4 py-2 rounded hover:bg-gray-700 focus:bg-gray-700 flex items-center"
            >
              Users
            </Link>
          )}
        </nav>
      </div>

      {/* ---------- Main Content ---------- */}
      <div className="flex-1 min-h-screen p-4 md:p-6 bg-gray-100">
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="md:hidden mb-4 px-4 py-2 bg-gray-800 text-white rounded"
        >
          {isDrawerOpen ? "Close Menu" : "Open Menu"}
        </button>

        <h1 className="text-xl font-bold mb-4">Monthly Attendance Report</h1>

        {/* Export Button */}
        <button
          onClick={exportToExcel}
          className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Export Report
        </button>

        {/* ---------- Filters ---------- */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          {/* Month */}
          <div>
            <label className="mr-2 font-semibold">Select Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="border rounded px-2 py-1"
            />
          </div>

          {/* Group (super-admin only) */}
          {storedUser?.role === "super admin" && (
            <div>
              <label className="mr-2 font-semibold">Filter by Group:</label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="RL">RL</option>
                {/* add more groups if needed */}
              </select>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="mr-2 font-semibold">Filter by User Role:</label>
            <select
              value={selectedRole}
              onChange={handleRoleChange}
              className="border rounded px-2 py-1"
            >
              {storedUser?.role === "super admin" && (
                <option value="office">Office</option>
              )}
              {storedUser?.role === "super admin" && (
                <option value="super admin">Super Admin</option>
              )}
              {(storedUser?.role === "super admin" ||
                storedUser?.role === "RSM") && <option value="RSM">RSM</option>}

              {(storedUser?.role === "super admin" ||
                storedUser?.role === "RSM" ||
                storedUser?.role === "TSO") && <option value="TSO">TSO</option>}

              {(storedUser?.role === "super admin" ||
                storedUser?.role === "RSM" ||
                storedUser?.role === "ASM") && <option value="ASM">ASM</option>}

              <option value="SO">SO</option>
            </select>
          </div>

          {/* ----- NEW ZONE FILTER (super-admin only) ----- */}
          {storedUser?.role === "super admin" && (
            <div>
              <label className="mr-2 font-semibold">Filter by Zone:</label>
              <select
                value={selectedZone}
                onChange={handleZoneChange}
                className="border rounded px-2 py-1"
              >
                <option value="">All Zones</option>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ---------- Table / Loading / Error ---------- */}
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : reports.length > 0 ? (
          <div className="overflow-x-auto w-[95vw] sm:w-[auto]">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-300 px-4 py-2">Username</th>
                  <th className="border border-gray-300 px-4 py-2">Role</th>
                  <th className="border border-gray-300 px-4 py-2">Zone</th>
                  <th className="border border-gray-300 px-4 py-2">
                    Total Working Days
                  </th>
                  <th className="border border-gray-300 px-4 py-2">Holidays</th>
                  <th className="border border-gray-300 px-4 py-2">
                    Approved Leave
                  </th>
                  <th className="border border-gray-300 px-4 py-2 bg-red-500 text-white">
                    Absent
                  </th>
                  <th className="border border-gray-300 px-4 py-2 bg-[#0B6222] text-white">
                    Extra Day
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    Total Check-Ins
                  </th>
                  <th className="border border-gray-300 px-4 py-2 bg-red-500 text-white">
                    Late Check-Ins (10.15 AM)
                  </th>
                  <th className="border border-gray-300 px-4 py-2 bg-[#0B6222] text-white">
                    Late Check-Outs (8.00 PM)
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    Late Adjustment
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    Daily Report
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report, idx) => (
                  <tr key={idx} className="text-center">
                    <td className="border border-gray-300 px-4 py-2">
                      {report.username}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {report?.role}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {report?.zone}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {totalWorkingDays}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {dayCount -
                        totalWorkingDays -
                        (report.totalCheckIns - totalWorkingDays > 0
                          ? report.totalCheckIns - totalWorkingDays
                          : 0)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {report.approvedLeaves}
                    </td>
                    <td className="border border-gray-300 bg-red-300 px-4 py-2">
                      {totalWorkingDays -
                        report.totalCheckIns -
                        report.approvedLeaves >
                      0
                        ? totalWorkingDays -
                          report.totalCheckIns -
                          report.approvedLeaves
                        : 0}
                    </td>
                    <td className="border border-gray-300 bg-[#9BB97F] px-4 py-2">
                      {report.totalCheckIns - totalWorkingDays > 0
                        ? report.totalCheckIns - totalWorkingDays
                        : 0}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {report.totalCheckIns}
                    </td>
                    <td className="border border-gray-300 bg-red-300 px-4 py-2">
                      {report.lateCheckIns}
                    </td>
                    <td className="border border-gray-300 bg-[#9BB97F] px-4 py-2">
                      {report.lateCheckOuts}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {report.lateCheckIns - report.lateCheckOuts}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Link to={`/admin/view-report/${report.userId}`}>
                        View Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No reports found for this month.</p>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
