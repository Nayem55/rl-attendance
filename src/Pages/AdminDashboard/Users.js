import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // ----- Form states -----
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    number: "",
    password: "",
    role: "",
    group: "RL", // default to RL (you can make it selectable later)
    zone: "",
    outlet: "",
  });
  const [isAddUserVisible, setIsAddUserVisible] = useState(false);

  // ----- Update modal -----
  const [updateUser, setUpdateUser] = useState(null);

  // ----- Drawer (mobile) -----
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // ----- Filter -----
  const [zoneFilter, setZoneFilter] = useState(""); // empty = show all

  // ------------------------------------------------------------------
  // Fetch all users
  // ------------------------------------------------------------------
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        "https://attendance-app-server-blue.vercel.app/getAllUser"
      );
      setUsers(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Create user
  // ------------------------------------------------------------------
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(
        "https://attendance-app-server-blue.vercel.app/api/users",
        newUser
      );
      toast.success("User created successfully!");
      setNewUser({
        name: "",
        email: "",
        number: "",
        password: "",
        role: "",
        group: "RL",
        zone: "",
        outlet: "",
      });
      setIsAddUserVisible(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Delete user
  // ------------------------------------------------------------------
  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await axios.delete(
        `https://attendance-app-server-blue.vercel.app/api/users/${userId}`
      );
      toast.success("User deleted");
      fetchUsers();
    } catch (err) {
      toast.error("Failed to delete user");
    }
  };

  // ------------------------------------------------------------------
  // Update user
  // ------------------------------------------------------------------
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(
        `https://attendance-app-server-blue.vercel.app/updateUser/${updateUser._id}`,
        updateUser
      );
      toast.success("User updated");
      setUpdateUser(null);
      fetchUsers();
    } catch (err) {
      toast.error("Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Load users on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    fetchUsers();
  }, []);

  // ------------------------------------------------------------------
  // 1. Filter users that belong to group "RL"
  // 2. Apply zone filter if selected
  // ------------------------------------------------------------------
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => u.group === "RL") // <-- only RL group
      .filter((u) => (zoneFilter ? u.zone === zoneFilter : true));
  }, [users, zoneFilter]);

  // Get unique zones for the dropdown (only from RL users)
  const availableZones = useMemo(() => {
    const zones = [...new Set(users.filter((u) => u.group === "RL").map((u) => u.zone))];
    return zones.filter(Boolean).sort();
  }, [users]);

  return (
    <div className="flex w-[95vw] sm:w-[100vw] overflow-x-hidden">
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
          <Link to="/admin/today-report" className="px-4 py-2 rounded hover:bg-gray-700">
            Today's Report
          </Link>
          <Link to="/admin/monthly-summary" className="px-4 py-2 rounded hover:bg-gray-700">
            Monthly Summary
          </Link>
          <Link to="/admin/monthly-details" className="px-4 py-2 rounded hover:bg-gray-700">
            Monthly Details
          </Link>
          <Link to="/admin/applications" className="px-4 py-2 rounded hover:bg-gray-700">
            Leave Requests
          </Link>
          <Link to="/admin/user" className="px-4 py-2 rounded hover:bg-gray-700 bg-gray-700">
            Users
          </Link>
        </nav>
      </div>

      {/* ---------- Main Content ---------- */}
      <div className="flex-1 p-4 md:p-6 bg-gray-100 min-h-screen">
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="md:hidden mb-4 px-4 py-2 bg-gray-800 text-white rounded"
        >
          {isDrawerOpen ? "Close Menu" : "Open Menu"}
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold">User Management (Group RL)</h1>

          <div className="flex gap-3">
            {/* Zone Filter */}
            <div className="flex items-center gap-2">
              <label className="font-medium">Zone:</label>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="px-3 py-2 border rounded bg-white"
              >
                <option value="">All Zones</option>
                {availableZones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              {zoneFilter && (
                <button
                  onClick={() => setZoneFilter("")}
                  className="text-sm text-red-600 underline"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              onClick={() => setIsAddUserVisible(!isAddUserVisible)}
              className="px-4 py-2 bg-[#002B54] hover:bg-black text-white rounded"
            >
              {isAddUserVisible ? "Hide Form" : "Add User"}
            </button>
          </div>
        </div>

        {/* ---------- Add User Form ---------- */}
        {isAddUserVisible && (
          <form onSubmit={handleCreateUser} className="bg-white p-6 rounded shadow-md mb-8">
            <h2 className="text-xl font-bold mb-4">Add New User (RL)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {["name", "email", "number", "password", "role", "zone", "outlet"].map((field) => (
                <div key={field}>
                  <label className="block text-sm font-semibold capitalize mb-1">
                    {field === "number" ? "Phone Number" : field}
                  </label>
                  <input
                    type={field === "email" ? "email" : field === "password" ? "password" : "text"}
                    value={newUser[field]}
                    onChange={(e) => setNewUser({ ...newUser, [field]: e.target.value })}
                    required={["name", "number", "password", "role"].includes(field)}
                    className="w-full p-2 border rounded"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full md:w-auto px-6 py-3 bg-[#002B54] hover:bg-black text-white rounded disabled:opacity-60"
            >
              {loading ? "Adding…" : "Add User"}
            </button>
          </form>
        )}

        {/* ---------- Users Table ---------- */}
        <div className="bg-white rounded shadow-md overflow-x-auto">
          {loading ? (
            <p className="p-4">Loading users…</p>
          ) : (
            <>
              <div className="p-4 font-semibold text-gray-700">
                Showing {filteredUsers.length} user{filteredUsers.length !== 1 && "s"}
                {zoneFilter && ` in zone "${zoneFilter}"`}
              </div>
              <table className="w-full table-auto">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-left">Role</th>
                    <th className="px-4 py-2 text-left">Zone</th>
                    <th className="px-4 py-2 text-left">Outlet</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-gray-500">
                        No RL users found {zoneFilter && `for zone "${zoneFilter}"`}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user._id} className="border-t">
                        <td className="px-4 py-3">{user.name}</td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">{user.number}</td>
                        <td className="px-4 py-3">{user.role}</td>
                        <td className="px-4 py-3">{user.zone || "-"}</td>
                        <td className="px-4 py-3">{user.outlet || "-"}</td>
                        <td className="px-4 py-3 space-x-2">
                          <button
                            onClick={() => setUpdateUser(user)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user._id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* ---------- Update Modal ---------- */}
        {updateUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl m-4">
              <h2 className="text-xl font-bold mb-4">Update User</h2>
              <form onSubmit={handleUpdateUser}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {["name", "email", "number", "password", "role", "zone", "outlet"].map((field) => (
                    <div key={field}>
                      <label className="block text-sm font-semibold capitalize mb-1">
                        {field === "number" ? "Phone Number" : field}
                      </label>
                      <input
                        type={field === "email" ? "email" : field === "password" ? "password" : "text"}
                        value={updateUser[field] || ""}
                        onChange={(e) =>
                          setUpdateUser({ ...updateUser, [field]: e.target.value })
                        }
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    {loading ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateUser(null)}
                    className="px-5 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagementPage;