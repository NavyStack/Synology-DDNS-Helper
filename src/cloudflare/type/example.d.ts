// Path Parameters
type DnsRecordPathParams = {
  zone_id: string; // <= 32 characters
  dns_record_id: string; // <= 32 characters
};

// Common Headers
type ApiHeaders = {
  'X-Auth-Email': string;
  'X-Auth-Key': string;
};

// Request Body for Overwrite DNS Record
type OverwriteDnsRecordRequestBody = {
  comment?: string; // Optional comment about the DNS record
  name: string; // DNS record name (Punycode format), 1 to 255 characters
  proxied?: boolean; // Whether to enable Cloudflare's proxy, default is false
  settings?: Record<string, unknown>; // DNS record-specific settings
  tags?: string[]; // Custom tags
  ttl?: number; // TTL in seconds, 1 for 'automatic', valid range is 30-86400
  content: string; // A valid IPv4 address
  type: 'A'; // The record type, 'A' in this case
};

// Response Body for Overwrite DNS Record
type OverwriteDnsRecordResponseBody = {
  success: boolean;
  errors: {
    code: number;
    message: string;
  }[];
  messages: {
    code: number;
    message: string;
  }[];
  result?: {
    comment_modified_on?: string; // Date-time of the last modification
    created_on: string; // Date-time when the record was created
    id: string; // Record ID, <= 32 characters
    meta: Record<string, unknown>; // Cloudflare-specific metadata
    modified_on: string; // Date-time when the record was last modified
    proxiable: boolean; // If the record can be proxied
    tags_modified_on?: string; // Date-time of last tag modification
    comment: string; // Comment or note
    name: string; // DNS record name
    proxied: boolean; // If the record is proxied
    settings: Record<string, unknown>; // Settings for the DNS record
    tags: string[]; // Custom tags
    ttl: number; // Time to live (TTL)
    content: string; // IPv4 content
    type: 'A'; // Record type
  };
};

// Request Body for Create DNS Record
type CreateDnsRecordRequestBody = {
  comment?: string; // Optional comment about the DNS record
  name: string; // DNS record name (Punycode format), 1 to 255 characters
  proxied?: boolean; // Whether to enable Cloudflare's proxy, default is false
  settings?: Record<string, unknown>; // DNS record-specific settings
  tags?: string[]; // Custom tags
  ttl?: number; // TTL in seconds, 1 for 'automatic', valid range is 30-86400
  content: string; // A valid IPv4 address
  type: 'A'; // The record type, 'A' in this case
};

// Response Body for Create DNS Record
type CreateDnsRecordResponseBody = {
  success: boolean;
  errors: {
    code: number;
    message: string;
  }[];
  messages: {
    code: number;
    message: string;
  }[];
  result?: {
    comment_modified_on?: string; // Date-time of the last modification
    created_on: string; // Date-time when the record was created
    id: string; // Record ID, <= 32 characters
    meta: Record<string, unknown>; // Cloudflare-specific metadata
    modified_on: string; // Date-time when the record was last modified
    proxiable: boolean; // If the record can be proxied
    tags_modified_on?: string; // Date-time of last tag modification
    comment: string; // Comment or note
    name: string; // DNS record name
    proxied: boolean; // If the record is proxied
    settings: Record<string, unknown>; // Settings for the DNS record
    tags: string[]; // Custom tags
    ttl: number; // Time to live (TTL)
    content: string; // IPv4 content
    type: 'A'; // Record type
  };
};

// List Zones Request Query Parameters
type ListZonesQueryParams = {
  account?: {
    id?: string;
    name?: string; // Filter operators like contains, starts_with, etc.
  };
  direction?: 'asc' | 'desc';
  match?: 'any' | 'all';
  name?: string; // Filter operators like contains, starts_with, etc.
  order?: 'name' | 'status' | 'account.id' | 'account.name';
  page?: number; // Page number, default 1
  per_page?: number; // Number of zones per page, 5 to 50, default 20
  status?: 'initializing' | 'pending' | 'active' | 'moved';
};

// Response Body for List Zones
type ListZonesResponseBody = {
  success: boolean;
  errors: {
    code: number;
    message: string;
  }[];
  messages: {
    code: number;
    message: string;
  }[];
  result?: {
    account: {
      id: string;
      name: string;
    };
    activated_on: string;
    created_on: string;
    development_mode: number;
    id: string;
    meta: Record<string, unknown>;
    modified_on: string;
    name: string;
    name_servers: string[];
    original_dnshost: string;
    original_name_servers: string[];
    original_registrar: string;
    owner: Record<string, unknown>;
    paused: boolean;
    status: 'initializing' | 'pending' | 'active' | 'moved';
    type: 'full' | 'partial' | 'secondary';
    vanity_name_servers?: string[];
  }[];
  result_info: {
    count: number;
    page: number;
    per_page: number;
    total_count: number;
  };
};
