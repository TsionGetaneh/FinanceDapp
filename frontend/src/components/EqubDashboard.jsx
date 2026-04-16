import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  ChevronRight,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ethers } from "ethers";

const EqubDashboard = ({ account, contracts, provider }) => {
  const [myGroups, setMyGroups] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("my"); // 'my' or 'discover'
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contribution: "100",
    duration: "86400", // 1 day in seconds
    maxMembers: "10",
  });
  const [fetchStatus, setFetchStatus] = useState("idle"); // idle, loading, error, success

  const fetchData = async () => {
    if (!contracts.EqubManager || !account || !provider) {
      setFetchStatus("missing_context");
      return;
    }

    try {
      setLoading(true);
      setFetchStatus("fetching_contract_code");

      const code = await provider.getCode(contracts.EqubManager.target);
      if (code === "0x" || code === "0x0") {
        setFetchStatus("contract_not_found");
        setLoading(false);
        return;
      }

      setFetchStatus("fetching_next_id");
      const nextIdBigInt = await contracts.EqubManager.nextGroupId();
      const nextId = Number(nextIdBigInt);

      const myGroupList = [];
      const allGroupList = [];
      const normalizedAccount = account.toLowerCase();

      setFetchStatus(`fetching_groups_0_to_${nextId}`);
      for (let i = 0; i < nextId; i++) {
        try {
          const g = await contracts.EqubManager.groups(i);
          const members = await contracts.EqubManager.getMembers(i);

          const isMember = members.some(
            (m) => m.toLowerCase() === normalizedAccount,
          );

          const groupData = {
            id: Number(g.id),
            name: g.name,
            contribution: ethers.formatEther(g.contributionAmount),
            cycle:
              Number(g.cycleDuration) / 86400 >= 1
                ? `${Number(g.cycleDuration) / 86400} Days`
                : `${Number(g.cycleDuration) / 3600} Hours`,
            membersCount: members.length,
            maxMembers: Number(g.maxMembers),
            status: g.isActive ? "Active" : "Completed",
            nextCycle: new Date(
              Number(g.nextCycleTime) * 1000,
            ).toLocaleDateString(),
            isMember,
          };

          if (isMember) myGroupList.push(groupData);
          if (g.isActive) allGroupList.push(groupData);
        } catch (err) {
          console.error(`Error fetching group ${i}:`, err);
        }
      }

      setMyGroups(myGroupList);
      setAllGroups(allGroupList);
      setFetchStatus(nextId > 0 ? "success" : "no_groups_on_chain");
    } catch (error) {
      console.error("Critical error in fetchData:", error);
      setFetchStatus("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [contracts.EqubManager, account]);

  const handleJoin = async (groupId) => {
    try {
      const tx = await contracts.EqubManager.joinGroup(groupId);
      await tx.wait();
      alert("Joined successfully!");
      fetchData();
    } catch (error) {
      console.error("Join failed:", error);
      alert("Join failed.");
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const tx = await contracts.EqubManager.createGroup(
        formData.name,
        ethers.parseEther(formData.contribution),
        BigInt(formData.duration),
        BigInt(formData.maxMembers),
      );
      await tx.wait();

      // Update state before alert so the UI changes immediately in the background
      setShowCreate(false);
      setTab("my");

      // Small delay to allow blockchain state to propagate
      setTimeout(() => fetchData(), 1000);

      alert(
        "Group created successfully! You can now see it in the 'My Equbs' tab.",
      );
    } catch (error) {
      console.error("Failed to create group:", error);
      alert("Failed to create group.");
    }
  };

  const handleContribute = async (groupId, amount) => {
    try {
      const tx = await contracts.EqubManager.contribute(groupId, {
        value: ethers.parseEther(amount),
      });
      await tx.wait();
      alert("Contribution successful!");
      fetchData();
    } catch (error) {
      console.error("Contribution failed:", error);
      alert("Contribution failed. Check console.");
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => setTab("my")}
            className={`text-xl font-bold pb-2 transition-all ${
              tab === "my"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-400"
            }`}
          >
            My Equbs ({myGroups.length})
          </button>
          <button
            onClick={() => setTab("discover")}
            className={`text-xl font-bold pb-2 transition-all ${
              tab === "discover"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-400"
            }`}
          >
            Discover ({allGroups.length})
          </button>
        </div>
        <div className="flex gap-2">
          {fetchStatus !== "success" && fetchStatus !== "idle" && (
            <div className="flex items-center gap-1 text-[10px] font-black uppercase text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
              Status: {fetchStatus.replace(/_/g, " ")}
            </div>
          )}
          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-black mb-6 text-indigo-900">
              Start an Equb
            </h3>
            <p className="text-[10px] text-gray-400 mb-4 truncate">
              Contract: {contracts.EqubManager.target}
            </p>
            <form onSubmit={handleCreateGroup} className="space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily Market Savings"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-indigo-500 font-medium"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                    Per Cycle (ETH)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.contribution}
                    onChange={(e) =>
                      setFormData({ ...formData, contribution: e.target.value })
                    }
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-indigo-500 font-black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                    Max Members
                  </label>
                  <input
                    type="number"
                    value={formData.maxMembers}
                    onChange={(e) =>
                      setFormData({ ...formData, maxMembers: e.target.value })
                    }
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-indigo-500 font-black"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-indigo-600 rounded-2xl font-bold text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {tab === "my" ? (
          myGroups.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-100">
              <Users className="mx-auto text-gray-200 mb-4" size={64} />
              <p className="text-gray-400 font-medium">
                You haven't joined any Equbs yet.
              </p>
              <button
                onClick={() => setTab("discover")}
                className="mt-4 text-indigo-600 font-bold hover:underline"
              >
                Explore existing groups
              </button>
            </div>
          ) : (
            myGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex justify-between items-center group cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex gap-5 items-center">
                  <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600">
                    <Users size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">
                      {group.name}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium">
                      {group.membersCount}/{group.maxMembers} members •{" "}
                      {group.cycle}
                    </p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="font-black text-indigo-600 text-lg">
                      {group.contribution} ETH
                    </p>
                    <p
                      className={`text-[10px] font-black uppercase tracking-widest ${
                        group.status === "Active"
                          ? "text-green-500"
                          : "text-gray-400"
                      }`}
                    >
                      {group.status}
                    </p>
                  </div>
                  <ChevronRight
                    className="text-gray-200 group-hover:text-indigo-600 transition-colors"
                    size={24}
                  />
                </div>
              </div>
            ))
          )
        ) : allGroups.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <Users className="mx-auto text-gray-200 mb-4" size={64} />
            <p className="text-gray-400 font-medium">
              No new groups found on the blockchain.
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-2xl text-[10px] text-gray-400 text-left space-y-1 font-mono">
              <p>Network: {provider?._network?.name || "Loading..."}</p>
              <p>Contract: {contracts.EqubManager.target}</p>
              <p>Status: {fetchStatus}</p>
            </div>
            {myGroups.length > 0 && (
              <button
                onClick={() => setTab("my")}
                className="mt-4 bg-indigo-50 text-indigo-600 px-6 py-2 rounded-xl font-bold hover:bg-indigo-100 transition-all"
              >
                Go to My Equbs
              </button>
            )}
          </div>
        ) : (
          allGroups.map((group) => (
            <div
              key={group.id}
              className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex justify-between items-center group"
            >
              <div className="flex gap-5 items-center">
                <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600">
                  <Users size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">
                    {group.name}
                  </h3>
                  <p className="text-xs text-gray-400 font-medium">
                    {group.membersCount}/{group.maxMembers} members •{" "}
                    {group.cycle}
                  </p>
                </div>
              </div>
              <div className="text-right flex items-center gap-4">
                <div>
                  <p className="font-black text-indigo-600 text-lg">
                    {group.contribution} ETH
                  </p>
                  {group.isMember ? (
                    <span className="mt-1 inline-block text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full">
                      Member
                    </span>
                  ) : group.membersCount >= group.maxMembers ? (
                    <span className="mt-1 inline-block text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                      Full
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoin(group.id)}
                      className="mt-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full hover:bg-indigo-600 hover:text-white transition-all"
                    >
                      Join Group
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {tab === "my" && myGroups.length > 0 && (
        <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-black text-2xl mb-2">Next Contribution</h3>
            <p className="text-indigo-100 text-sm mb-6 opacity-80 font-medium">
              Your contribution for{" "}
              <span className="font-bold text-white">{myGroups[0].name}</span>{" "}
              is due on {myGroups[0].nextCycle}.
            </p>
            <button
              onClick={() =>
                handleContribute(myGroups[0].id, myGroups[0].contribution)
              }
              className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all active:scale-95"
            >
              <CheckCircle size={22} /> Pay {myGroups[0].contribution} ETH
            </button>
          </div>
          <div className="absolute -right-8 -bottom-8 bg-white/10 w-48 h-48 rounded-full blur-3xl"></div>
        </div>
      )}
    </div>
  );
};

export default EqubDashboard;
