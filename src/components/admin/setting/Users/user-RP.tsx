'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X } from 'lucide-react';

interface RolePermission {
  unit: string;
  role: string;
  permissions: {
    create: boolean;
    read: boolean;
    view: boolean;
    update: boolean;
    approve: boolean;
    delete: boolean;
    provision: boolean;
  };
}

const roleData: RolePermission[] = [
  {
    unit: 'Divisi Teknologi Informasi',
    role: 'Super User',
    permissions: { create: false, read: true, view: true, update: false, approve: false, delete: false, provision: true },
  },
  {
    unit: 'Pemimpin Divisi Manajemen Risiko',
    role: 'Executive Reviewer',
    permissions: { create: false, read: true, view: true, update: false, approve: true, delete: false, provision: false },
  },
  {
    unit: 'Pemimpin Grup Risiko Kredit & Likuiditas',
    role: 'Supervisor',
    permissions: { create: false, read: true, view: true, update: true, approve: true, delete: false, provision: false },
  },
  {
    unit: 'Staf Risiko Kredit',
    role: 'Staff',
    permissions: { create: true, read: true, view: true, update: true, approve: false, delete: false, provision: false },
  },
  {
    unit: 'Staf Risiko Likuiditas & Pasar',
    role: 'Staff',
    permissions: { create: true, read: true, view: true, update: true, approve: false, delete: false, provision: false },
  },
  {
    unit: 'Pemimpin Grup Risiko Operasional',
    role: 'Supervisor',
    permissions: { create: false, read: true, view: true, update: true, approve: true, delete: false, provision: false },
  },
  {
    unit: 'Staf Risiko Operasional',
    role: 'Staff',
    permissions: { create: true, read: true, view: true, update: true, approve: false, delete: false, provision: false },
  },
  {
    unit: 'Pemimpin Unit IT Risk Management',
    role: 'Administrator',
    permissions: { create: true, read: true, view: true, update: true, approve: false, delete: false, provision: true },
  },
  {
    unit: 'Staf IT Risk Management',
    role: 'Staff',
    permissions: { create: true, read: true, view: true, update: true, approve: false, delete: false, provision: false },
  },
  {
    unit: 'Project Manager',
    role: 'Administrator',
    permissions: { create: true, read: true, view: true, update: true, approve: false, delete: false, provision: true },
  },
  {
    unit: 'Unit Supervisor',
    role: 'PIC Unit Kerja',
    permissions: {
      create: false,
      read: true,
      view: true,
      update: true,
      approve: true,
      delete: false,
      provision: false,
    },
  },
  {
    unit: 'Unit Staff',
    role: 'PIC Unit Kerja',
        permissions: {
      create: true,
      read: true,
      view: true,
      update: true,
      approve: false,
      delete: false,
      provision: false,
    },
  },
];

const UserRolePermission: React.FC = () => {
  return (
    <Card className="p-4 shadow-lg rounded-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Role User Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-100">
                <TableHead className="text-center font-bold">No</TableHead>
                <TableHead className="font-bold">Unit / Jabatan</TableHead>
                <TableHead className="font-bold">Role User</TableHead>
                <TableHead className="text-center font-bold">Create (C)</TableHead>
                <TableHead className="text-center font-bold">Read (R)</TableHead>
                <TableHead className="text-center font-bold">View (V)</TableHead>
                <TableHead className="text-center font-bold">Update / Write (U)</TableHead>
                <TableHead className="text-center font-bold">Approve (A)</TableHead>
                <TableHead className="text-center font-bold">Delete (D)</TableHead>
                <TableHead className="text-center font-bold">User Provisioning (UP)</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {roleData.map((item, index) => (
                <TableRow
                  key={index}
                  className={item.role === 'Super User' ? 'bg-pink-100 font-semibold' : 'bg-yellow-50'}
                >
                  <TableCell className="text-center">{index + 1}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>{item.role}</TableCell>

                  {Object.values(item.permissions).map((perm, i) => (
                    <TableCell key={i} className="text-center">
                      {perm ? (
                        <Check className="text-green-500 inline-block" size={18} />
                      ) : (
                        <X className="text-red-500 inline-block" size={18} />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserRolePermission;
