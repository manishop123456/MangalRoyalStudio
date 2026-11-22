'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type {
  AdminRoleName,
  CustomerDesignRecord,
  CustomizationProfileRecord,
  JewelleryProductSpec,
  ProductCustomizationAssignmentRecord,
  ProductModelAssetRecord,
} from '@mrs/shared';
import { ROLE_PERMISSIONS } from '@mrs/shared';

export interface AdminPhase2ModulesProps {
  activeModule: 'customization' | 'model-assets' | 'customer-designs';
  apiBase: string;
  adminFetch: (input: string, init?: RequestInit) => Promise<Response>;
  currentUserRole: AdminRoleName;
  products: JewelleryProductSpec[];
}

function can(role: AdminRoleName, perm: string): boolean {
  const perms = ROLE_PERMISSIONS[role] as readonly string[] | undefined;
  return Boolean(perms?.includes(perm));
}

export default function AdminPhase2Modules({
  activeModule,
  apiBase,
  adminFetch,
  currentUserRole,
  products,
}: AdminPhase2ModulesProps) {
  const [profiles, setProfiles] = useState<CustomizationProfileRecord[]>([]);
  const [assignments, setAssignments] = useState<ProductCustomizationAssignmentRecord[]>([]);
  const [modelAssets, setModelAssets] = useState<ProductModelAssetRecord[]>([]);
  const [designs, setDesigns] = useState<CustomerDesignRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create Profile form
  const [newProfileCode, setNewProfileCode] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileCategories, setNewProfileCategories] = useState('Rings');

  // Assign Product form
  const [assignSku, setAssignSku] = useState(products[0]?.sku || '');
  const [assignProfileId, setAssignProfileId] = useState('');
  const [assignCustomizable, setAssignCustomizable] = useState(true);
  const [assignDiamond, setAssignDiamond] = useState(true);
  const [assignEngraving, setAssignEngraving] = useState(true);
  const [assignMaxEngraving, setAssignMaxEngraving] = useState(20);

  // Model Asset Upload / External URL form
  const [modelSku, setModelSku] = useState(products[0]?.sku || '');
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalFileName, setExternalFileName] = useState('ring-model.glb');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeModule === 'customization' && can(currentUserRole, 'CUSTOMIZATION_VIEW')) {
        const res = await adminFetch(`${apiBase}/api/admin/customization/profiles`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'Failed to load customization profiles.');
        setProfiles(data.profiles || []);
        setAssignments(data.assignments || []);
        if (!assignProfileId && data.profiles?.[0]?.id) {
          setAssignProfileId(data.profiles[0].id);
        }
      } else if (activeModule === 'model-assets' && can(currentUserRole, 'CUSTOMIZATION_VIEW')) {
        const res = await adminFetch(`${apiBase}/api/admin/model-assets`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'Failed to load 3D model assets.');
        setModelAssets(data.modelAssets || []);
      } else if (activeModule === 'customer-designs' && can(currentUserRole, 'DESIGNS_VIEW')) {
        const res = await adminFetch(`${apiBase}/api/admin/designs`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'Failed to load customer saved designs.');
        setDesigns(data.designs || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch module data.');
    } finally {
      setLoading(false);
    }
  }, [activeModule, apiBase, adminFetch, currentUserRole, assignProfileId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch(`${apiBase}/api/admin/customization/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newProfileCode.trim().toUpperCase(),
          name: newProfileName.trim(),
          eligibleCategories: newProfileCategories
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Unable to create profile.');
      setNewProfileCode('');
      setNewProfileName('');
      setNotice(`Created customization profile "${data.profile.code}".`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create profile.');
    }
  };

  const handleToggleProfile = async (p: CustomizationProfileRecord) => {
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch(`${apiBase}/api/admin/customization/profiles/${encodeURIComponent(p.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Unable to update profile.');
      }
      setNotice(`Updated profile "${p.code}" status.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.');
    }
  };

  const handleAssignProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch(
        `${apiBase}/api/admin/customization/products/${encodeURIComponent(assignSku)}/assignment`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: assignProfileId,
            isCustomizable: assignCustomizable,
            allowDiamondSelection: assignDiamond,
            allowEngraving: assignEngraving,
            maxEngravingChars: assignMaxEngraving,
            disabledOptionCodes: [],
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Unable to assign customization.');
      setNotice(`Updated customization assignment for ${assignSku}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign customization.');
    }
  };

  const handleUploadModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelFile) {
      setError('Please select a .glb or .gltf file.');
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append('file', modelFile);
      const res = await adminFetch(
        `${apiBase}/api/admin/model-assets/${encodeURIComponent(modelSku)}/upload`,
        { method: 'POST', body: fd }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Model upload failed.');
      setModelFile(null);
      setNotice(`Uploaded 3D model for ${modelSku}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Model upload failed.');
    }
  };

  const handleAssociateExternalUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch(
        `${apiBase}/api/admin/model-assets/${encodeURIComponent(modelSku)}/external`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: externalFileName.trim() || 'model.glb',
            mimeType: externalFileName.endsWith('.gltf') ? 'model/gltf+json' : 'model/gltf-binary',
            assetUrl: externalUrl.trim(),
            status: 'ACTIVE',
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to associate model URL.');
      setExternalUrl('');
      setNotice(`Associated external 3D asset for ${modelSku}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to associate model URL.');
    }
  };

  const handleDeleteModel = async (sku: string) => {
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch(`${apiBase}/api/admin/model-assets/${encodeURIComponent(sku)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Unable to remove 3D model.');
      }
      setNotice(`Removed 3D model for ${sku}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove 3D model.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {error ? (
        <div className="mrs-card" style={{ borderColor: '#B91C1C', color: '#991B1B' }}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mrs-card" style={{ borderColor: '#15803D', color: '#166534' }}>
          {notice}
        </div>
      ) : null}
      {loading ? <div className="mrs-card">Loading module data…</div> : null}

      {activeModule === 'customization' && (
        <>
          <div className="mrs-card">
            <div className="mrs-card-header">
              <h2 className="mrs-card-title">Customization Profiles ({profiles.length})</h2>
            </div>
            {profiles.length === 0 ? (
              <p>No customization profiles configured yet.</p>
            ) : (
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Categories</th>
                      <th>Groups / Options</th>
                      <th>Status</th>
                      {can(currentUserRole, 'CUSTOMIZATION_MANAGE') && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => (
                      <tr key={p.id}>
                        <td><code>{p.code}</code></td>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.eligibleCategories.join(', ') || 'All'}</td>
                        <td>
                          {p.groups.length} groups /{' '}
                          {p.groups.reduce((sum, g) => sum + g.options.length, 0)} options
                        </td>
                        <td>
                          <span className={`mrs-badge ${p.isActive ? 'mrs-badge-burgundy' : ''}`}>
                            {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        {can(currentUserRole, 'CUSTOMIZATION_MANAGE') && (
                          <td>
                            <button
                              type="button"
                              className="mrs-btn-secondary"
                              onClick={() => handleToggleProfile(p)}
                            >
                              {p.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {can(currentUserRole, 'CUSTOMIZATION_MANAGE') && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
              <form className="mrs-card" onSubmit={handleCreateProfile}>
                <h3 className="mrs-card-title" style={{ marginBottom: '12px' }}>Create Customization Profile</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    required
                    placeholder="Profile Code (e.g., BESPOKE_NECKLACES)"
                    value={newProfileCode}
                    onChange={(e) => setNewProfileCode(e.target.value)}
                    className="mrs-input"
                  />
                  <input
                    required
                    placeholder="Display Name"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="mrs-input"
                  />
                  <input
                    placeholder="Eligible Categories (comma separated)"
                    value={newProfileCategories}
                    onChange={(e) => setNewProfileCategories(e.target.value)}
                    className="mrs-input"
                  />
                  <button type="submit" className="mrs-btn-primary">Create Profile</button>
                </div>
              </form>

              <form className="mrs-card" onSubmit={handleAssignProduct}>
                <h3 className="mrs-card-title" style={{ marginBottom: '12px' }}>Assign Product Customization</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select value={assignSku} onChange={(e) => setAssignSku(e.target.value)} className="mrs-input">
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.sku} — {p.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignProfileId}
                    onChange={(e) => setAssignProfileId(e.target.value)}
                    className="mrs-input"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                  <label style={{ fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={assignCustomizable}
                      onChange={(e) => setAssignCustomizable(e.target.checked)}
                    />{' '}
                    Customizable Enabled
                  </label>
                  <label style={{ fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={assignDiamond}
                      onChange={(e) => setAssignDiamond(e.target.checked)}
                    />{' '}
                    Allow Diamond Grade Selection
                  </label>
                  <label style={{ fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={assignEngraving}
                      onChange={(e) => setAssignEngraving(e.target.checked)}
                    />{' '}
                    Allow Engraving (Max Chars:{' '}
                    <input
                      type="number"
                      min={0}
                      max={80}
                      value={assignMaxEngraving}
                      onChange={(e) => setAssignMaxEngraving(Number(e.target.value))}
                      style={{ width: '56px' }}
                    />
                    )
                  </label>
                  <button type="submit" className="mrs-btn-primary">Save Product Assignment</button>
                </div>
              </form>
            </div>
          )}

          <div className="mrs-card">
            <h3 className="mrs-card-title" style={{ marginBottom: '12px' }}>
              Explicit Product Assignments ({assignments.length})
            </h3>
            {assignments.length === 0 ? (
              <p>No explicit overrides yet; products inherit category-matched active profiles.</p>
            ) : (
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Profile</th>
                      <th>Customizable</th>
                      <th>Diamonds</th>
                      <th>Engraving</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id}>
                        <td><code>{a.productSku || a.productMetadataId}</code></td>
                        <td>{profiles.find((p) => p.id === a.profileId)?.code || a.profileId}</td>
                        <td>{a.isCustomizable ? 'Yes' : 'No'}</td>
                        <td>{a.allowDiamondSelection ? 'Yes' : 'No'}</td>
                        <td>{a.allowEngraving ? `Yes (${a.maxEngravingChars})` : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeModule === 'model-assets' && (
        <>
          {can(currentUserRole, 'MODEL_ASSETS_MANAGE') && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
              <form className="mrs-card" onSubmit={handleUploadModel}>
                <h3 className="mrs-card-title" style={{ marginBottom: '12px' }}>Upload Managed .glb / .gltf Model</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select value={modelSku} onChange={(e) => setModelSku(e.target.value)} className="mrs-input">
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.sku} — {p.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    onChange={(e) => setModelFile(e.target.files?.[0] || null)}
                  />
                  <button type="submit" className="mrs-btn-primary">Upload &amp; Attach 3D Model</button>
                </div>
              </form>

              <form className="mrs-card" onSubmit={handleAssociateExternalUrl}>
                <h3 className="mrs-card-title" style={{ marginBottom: '12px' }}>Associate External 3D Asset URL</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    required
                    placeholder="https://cdn.example.com/models/ring.glb"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    className="mrs-input"
                  />
                  <input
                    required
                    placeholder="Filename (e.g., ring.glb)"
                    value={externalFileName}
                    onChange={(e) => setExternalFileName(e.target.value)}
                    className="mrs-input"
                  />
                  <button type="submit" className="mrs-btn-primary">Associate External URL</button>
                </div>
              </form>
            </div>
          )}

          <div className="mrs-card">
            <div className="mrs-card-header">
              <h2 className="mrs-card-title">Configured 3D Product Model Assets ({modelAssets.length})</h2>
            </div>
            {modelAssets.length === 0 ? (
              <p>No 3D model assets configured. Products cleanly fall back to their Dawn photo gallery.</p>
            ) : (
              <div className="mrs-table-wrap">
                <table className="mrs-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>File Name</th>
                      <th>Provider</th>
                      <th>Size</th>
                      <th>Status</th>
                      {can(currentUserRole, 'MODEL_ASSETS_MANAGE') && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {modelAssets.map((m) => (
                      <tr key={m.id}>
                        <td><code>{m.productSku}</code></td>
                        <td>{m.fileName}</td>
                        <td>{m.storageProvider}</td>
                        <td>{m.fileSizeBytes ? `${(m.fileSizeBytes / 1024).toFixed(1)} KB` : 'External'}</td>
                        <td><span className="mrs-badge mrs-badge-burgundy">{m.status}</span></td>
                        {can(currentUserRole, 'MODEL_ASSETS_MANAGE') && (
                          <td>
                            <button
                              type="button"
                              className="mrs-btn-secondary"
                              onClick={() => handleDeleteModel(m.productSku)}
                            >
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeModule === 'customer-designs' && (
        <div className="mrs-card">
          <div className="mrs-card-header">
            <h2 className="mrs-card-title">Customer Saved Bespoke Designs ({designs.length})</h2>
          </div>
          {designs.length === 0 ? (
            <p>No customer bespoke designs saved yet.</p>
          ) : (
            <div className="mrs-table-wrap">
              <table className="mrs-table">
                <thead>
                  <tr>
                    <th>Design Name</th>
                    <th>Product</th>
                    <th>Selections</th>
                    <th>Quoted Total</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {designs.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.name}</strong></td>
                      <td>{d.productTitle} (<code>{d.productSku}</code>)</td>
                      <td>
                        {d.selectionSnapshot.map((s) => `${s.groupName}: ${s.label}`).join(' · ')}
                      </td>
                      <td>₹{Number(d.lastQuotedPriceInr).toLocaleString('en-IN')}</td>
                      <td>{new Date(d.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
